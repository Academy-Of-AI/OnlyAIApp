import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** GET /api/stripe/invoices — the signed-in user's Stripe invoices (with PDF links). */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("stripe_customer_id").eq("id", user.id).single();
  const customer = profile?.stripe_customer_id as string | undefined;
  if (!customer) return NextResponse.json({ invoices: [] });

  try {
    const list = await stripe.invoices.list({ customer, limit: 24 });
    const invoices = list.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      created: inv.created * 1000,
      amount: inv.amount_paid || inv.total,
      currency: inv.currency,
      status: inv.status,
      pdf: inv.invoice_pdf,
      url: inv.hosted_invoice_url,
    }));
    return NextResponse.json({ invoices });
  } catch (err) {
    console.error("[stripe/invoices]", err);
    return NextResponse.json({ invoices: [] });
  }
}
