import { createCheckoutSession } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { priceId } = await request.json() as { priceId: string };
  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!;

  const { data: profile } = await supabase
    .from("profiles").select("stripe_customer_id").eq("id", user.id).single();

  const session = await createCheckoutSession({
    userId: user.id,
    priceId,
    customerId: profile?.stripe_customer_id ?? undefined,
    successUrl: `${origin}/dashboard?upgraded=1`,
    cancelUrl: `${origin}/upgrade`,
  });

  return NextResponse.json({ url: session.url });
}
