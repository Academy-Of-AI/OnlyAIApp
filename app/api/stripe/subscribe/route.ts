import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Prices in cents. Core $8/mo, yearly −25% (×12×0.75). Pro $17/mo, yearly −30% (×12×0.7). */
const PRICES = {
  core: { month: 800,  year: 7200,  name: "Core",
          desc: "8 projects · delete & recreate · provision + Plan Pack + hand off" },
  pro:  { month: 1700, year: 14280, name: "Pro",
          desc: "Everything in Core + advanced Pilot (auto-capture, drift, launch readiness)" },
} as const;
type PlanKey = keyof typeof PRICES;

/**
 * POST /api/stripe/subscribe  Body: { plan?: "core" | "pro"; interval?: "month" | "year" }
 * Starts a subscription checkout using inline price_data — no pre-created Stripe price needed.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { interval?: "month" | "year"; plan?: string };
  const plan: PlanKey = body.plan === "core" ? "core" : "pro";
  const interval: "month" | "year" = body.interval === "year" ? "year" : "month";
  const cfg = PRICES[plan];

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!;
  const { data: profile } = await supabase
    .from("profiles").select("stripe_customer_id, plan").eq("id", user.id).single();

  if (profile?.plan === plan) {
    return NextResponse.json({ error: `You're already on ${cfg.name}.` }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: interval === "year" ? cfg.year : cfg.month,
        recurring: { interval },
        product_data: {
          name: interval === "year" ? `OnlyAIApp — ${cfg.name} (yearly)` : `OnlyAIApp — ${cfg.name}`,
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
