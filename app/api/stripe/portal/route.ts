import { createPortalSession } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("stripe_customer_id").eq("id", user.id).single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!;
  const session = await createPortalSession({
    customerId: profile.stripe_customer_id,
    returnUrl: `${origin}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
