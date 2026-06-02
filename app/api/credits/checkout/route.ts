import { CREDIT_PACKS, type CreditPackKey, stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/credits/checkout
 * Body: { pack: "starter" | "builder" | "accelerate" }
 * Creates a Stripe one-time checkout session for build credit packs.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pack } = (await request.json()) as { pack: CreditPackKey };
  if (!CREDIT_PACKS[pack]) {
    return NextResponse.json({ error: "Invalid pack" }, { status: 400 });
  }

  const { credits, amountCents, label, badge } = CREDIT_PACKS[pack];
  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!;

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: {
            name: `OnlyAIApp — ${badge} pack`,
            description: `${label} · ${credits} AI builds`,
          },
        },
      },
    ],
    metadata: {
      type: "credits",
      userId: user.id,
      pack,
      credits: String(credits),
    },
    success_url: `${origin}/dashboard?credits=purchased`,
    cancel_url:  `${origin}/dashboard`,
    ...(profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_creation: "always" }),
  });

  return NextResponse.json({ url: session.url });
}
