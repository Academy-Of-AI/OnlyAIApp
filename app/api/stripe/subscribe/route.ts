import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Monthly price for Pro, in cents. Change here to reprice. */
const PRO_PRICE_CENTS = 1200;

/**
 * POST /api/stripe/subscribe
 * Starts a Pro subscription checkout using inline price_data — no pre-created
 * Stripe product/price needed.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        unit_amount: PRO_PRICE_CENTS,
        recurring: { interval: "month" },
        product_data: {
          name: "Vibe Launchpad — Pro",
          description: "Unlimited projects, plan-of-record, course-keeper, auto CLAUDE.md sync",
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
