import { constructWebhookEvent } from "@/lib/stripe";
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
        if (!userId || !session.customer) break;
        await supabase.from("profiles")
          .update({ stripe_customer_id: session.customer as string })
          .eq("id", userId);
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
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabase.from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("id", sub.id);
        break;
      }
    }
  } catch (err) {
    console.error("[stripe/webhooks]", event.type, err);
  }

  return NextResponse.json({ received: true });
}
