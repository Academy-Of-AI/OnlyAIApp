import { track } from "@/lib/analytics";
import { constructWebhookEvent } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, sig);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        // Always save the Stripe customer ID
        if (session.customer) {
          await supabase.from("profiles")
            .update({ stripe_customer_id: session.customer as string })
            .eq("id", userId);
        }

        // Credit-pack purchase — add credits using the service-role client
        // so RLS doesn't block the update from the webhook server-side context.
        if (session.metadata?.type === "credits") {
          const credits = parseInt(session.metadata.credits ?? "0", 10);
          if (credits > 0) {
            const admin = await createAdminClient();
            await admin.rpc("add_build_credits", {
              p_user_id: userId,
              p_amount: credits,
            });
            await track("credits_purchased", userId, {
              pack: session.metadata.pack,
              credits,
              amount_cents: session.amount_total,
            });
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        await supabase.from("subscriptions").upsert({
          id: sub.id,
          user_id: userId,
          stripe_customer_id: sub.customer as string,
          status: sub.status,
          price_id: sub.items.data[0]?.price.id,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        });
        if (sub.status === "active" || sub.status === "trialing") {
          // Flip the user onto Pro so gated features unlock
          await supabase.from("profiles").update({ plan: "pro" }).eq("id", userId);
          await track("plan_upgraded", userId, {
            price_id: sub.items.data[0]?.price.id,
            subscription_id: sub.id,
          });
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabase.from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        // Downgrade the user back to free
        const userId = sub.metadata?.userId;
        if (userId) await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
        break;
      }
    }
  } catch (err) {
    console.error("[stripe/webhooks]", event.type, err);
  }

  return NextResponse.json({ received: true });
}
