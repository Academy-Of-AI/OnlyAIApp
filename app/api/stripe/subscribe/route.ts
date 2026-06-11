import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Prices in cents. Core $8/mo, yearly −25% (×12×0.75). Pro $17/mo, yearly −30% (×12×0.7). */
const PRICES = {
  core: { month: 800,  year: 7200,  name: "Core",
          desc: "8 projects (run several at once) · unlimited Plan Packs · provision + hand off" },
  pro:  { month: 1700, year: 14280, name: "Pro",
          desc: "Everything in Core + advanced Pilot (auto-capture, drift, launch readiness)" },
} as const;
type PlanKey = keyof typeof PRICES;

/**
 * POST /api/stripe/subscribe  Body: { plan?: "core" | "pro"; interval?: "month" | "year" }
 * Starts a subscription checkout using inline price_data — no pre-created Stripe price needed.
 * If the user already has an active subscription, swaps the price on that subscription in
 * place (Core ⇄ Pro) instead of creating a second, double-billing subscription.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { interval?: "month" | "year"; plan?: string };
  const plan: PlanKey = body.plan === "core" ? "core" : "pro";
  const interval: "month" | "year" = body.interval === "year" ? "year" : "month";
  const cfg = PRICES[plan];
  const unitAmount = interval === "year" ? cfg.year : cfg.month;
  const productName =
    interval === "year" ? `OnlyAIApp — ${cfg.name} (yearly)` : `OnlyAIApp — ${cfg.name}`;

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!;
  const { data: profile } = await supabase
    .from("profiles").select("stripe_customer_id, plan").eq("id", user.id).single();

  if (profile?.plan === plan) {
    return NextResponse.json({ error: `You're already on ${cfg.name}.` }, { status: 400 });
  }

  // If the customer already has an active subscription, SWAP the price on it in place
  // rather than creating a second subscription (the Core→Pro double-billing bug).
  if (profile?.stripe_customer_id) {
    const existing = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "active",
      limit: 1,
    });
    const sub = existing.data[0];
    const item = sub?.items.data[0];
    if (sub && item) {
      // Inline price (with inline product) — keeps the "no pre-created price" approach,
      // since subscription item price_data requires an existing product id.
      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: unitAmount,
        recurring: { interval },
        product_data: { name: productName },
      });

      const updated = await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, price: price.id }],
        proration_behavior: "create_prorations",
        // Stamp plan so the webhook flips the profile to the right tier (it defaults to Pro
        // when plan metadata is missing — see app/api/stripe/webhooks/route.ts).
        metadata: { userId: user.id, plan },
      });

      // No redirect needed — the swap is applied immediately. Webhook (customer.subscription.updated)
      // syncs the profile plan + subscriptions row. Return a success URL for the client to navigate to.
      return NextResponse.json({
        url: `${origin}/dashboard?upgraded=1`,
        subscriptionId: updated.id,
        swapped: true,
      });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: unitAmount,
        recurring: { interval },
        product_data: {
          name: productName,
          description: cfg.desc,
        },
      },
    }],
    subscription_data: { metadata: { userId: user.id, plan } },
    metadata: { type: "subscription", userId: user.id, plan },
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/upgrade`,
    ...(profile?.stripe_customer_id ? { customer: profile.stripe_customer_id } : {}),
  });

  return NextResponse.json({ url: session.url });
}
