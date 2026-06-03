import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Pro prices, in cents. Monthly $17.97; yearly billed at $14.97/mo ($179.64/yr). */
const PRO_MONTHLY_CENTS = 1797;
const PRO_YEARLY_CENTS = 17964;

/**
 * POST /api/stripe/subscribe  Body: { interval?: "month" | "year" }
 * Starts a Pro subscription checkout using inline price_data — no pre-created
 * Stripe product/price needed.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { interval?: "month" | "year" };
  const yearly = body.interval === "year";

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!;
  const { data: profile } = await supabase
    .from("profiles").select("stripe_customer_id, plan").eq("id", user.id).single();

  if (profile?.plan === "pro") {
    return NextResponse.json({ error: "You're already on Pro." }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: yearly ? PRO_YEARLY_CENTS : PRO_MONTHLY_CENTS,
        recurring: { interval: yearly ? "year" : "month" },
        product_data: {
          name: yearly ? "OnlyAIApp — Pro (yearly)" : "OnlyAIApp — Pro",
          description: "Unlimited Plan Packs + mockups · Pilot (auto-capture + drift) · up to 8 projects",
        },
      },
    }],
    subscription_data: { metadata: { userId: user.id, plan: "pro" } },
    metadata: { type: "subscription", userId: user.id, plan: "pro" },
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/upgrade`,
    ...(profile?.stripe_customer_id ? { customer: profile.stripe_customer_id } : {}),
  });

  return NextResponse.json({ url: session.url });
}
