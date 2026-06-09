import { track } from "@/lib/analytics";
import { constructWebhookEvent } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizePlan } from "@/lib/plan";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

/**
 * Stripe webhook handler.
 *
 * IMPORTANT: every DB write here MUST go through the service-role admin client
 * (createAdminClient). There is no authenticated user in a webhook request, so
 * the RLS-bound user client (createClient) silently no-ops every write — that
 * is exactly why paid users were staying on Free. The admin client bypasses RLS.
 *
 * On any write failure we return a non-2xx so Stripe retries the delivery; the
 * handlers are written to be idempotent (upserts / set-to-fixed-value updates)
 * so retries are safe.
 */
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

  // Service-role client — bypasses RLS so webhook writes actually persist.
  const supabase = await createAdminClient();

  // Resolve a user id from a subscription/customer id via the subscriptions
  // table. Used by events (e.g. invoices) whose payload carries no userId.
  async function resolveUserId(
    subscriptionId?: string | null,
    customerId?: string | null,
  ): Promise<string | null> {
    if (subscriptionId) {
      const { data } = await supabase
        .from("subscriptions").select("user_id").eq("id", subscriptionId).maybeSingle();
      if (data?.user_id) return data.user_id as string;
    }
    if (customerId) {
      const { data } = await supabase
        .from("subscriptions").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
      if (data?.user_id) return data.user_id as string;
    }
    return null;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        // Always save the Stripe customer ID
        if (session.customer) {
          const { error } = await supabase.from("profiles")
            .update({ stripe_customer_id: session.customer as string })
            .eq("id", userId);
          if (error) throw error;
        }

        // Credit-pack purchase — add credits via the service-role client.
        if (session.metadata?.type === "credits") {
          const credits = parseInt(session.metadata.credits ?? "0", 10);
          if (credits > 0) {
            const { error } = await supabase.rpc("add_build_credits", {
              p_user_id: userId,
              p_amount: credits,
            });
            if (error) throw error;
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

        const { error: subError } = await supabase.from("subscriptions").upsert({
          id: sub.id,
          user_id: userId,
          stripe_customer_id: sub.customer as string,
          status: sub.status,
          price_id: sub.items.data[0]?.price.id,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        });
        if (subError) throw subError;

        if (sub.status === "active" || sub.status === "trialing") {
          // Flip the user onto the purchased tier from metadata.plan (core/pro).
          // normalizePlan keeps this tier-aware and safe: anything that isn't a
          // recognised paid tier falls through to "free" rather than silently
          // granting Pro. Default an unset paid-subscription plan to "core".
          const tier = normalizePlan(sub.metadata?.plan ?? "core");
          const { error } = await supabase.from("profiles").update({ plan: tier }).eq("id", userId);
          if (error) throw error;
          await track("plan_upgraded", userId, {
            plan: tier,
            price_id: sub.items.data[0]?.price.id,
            subscription_id: sub.id,
          });
        } else if (sub.status === "past_due") {
          // Payment is failing — revoke paid access until it recovers.
          const { error } = await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
          if (error) throw error;
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          const { error } = await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
          if (error) throw error;
        }
        break;
      }

      case "invoice.payment_failed": {
        // A renewal/charge failed — revoke paid access. Resolve the user from
        // the subscription/customer since the invoice carries no userId metadata.
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        const userId = await resolveUserId(subscriptionId, customerId);
        if (!userId) break;

        const { error } = await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
        if (error) throw error;
        await track("plan_payment_failed", userId, {
          subscription_id: subscriptionId,
          invoice_id: invoice.id,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { error: subError } = await supabase.from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        if (subError) throw subError;

        // Downgrade the user back to free.
        const userId = sub.metadata?.userId ?? (await resolveUserId(sub.id, sub.customer as string));
        if (userId) {
          const { error } = await supabase.from("profiles").update({ plan: "free" }).eq("id", userId);
          if (error) throw error;
        }
        break;
      }
    }
  } catch (err) {
    // A DB write failed — log and return non-2xx so Stripe retries delivery.
    // Handlers are idempotent, so retrying is safe.
    console.error("[stripe/webhooks]", event.type, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
