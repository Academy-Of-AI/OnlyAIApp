import { NextResponse } from "next/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/plan";
import { createAccountLink, createConnectedAccount } from "@/lib/stripe";

/**
 * POST /api/stripe/connect
 * Managed payments: ensure the member has a Stripe connected account, then
 * return a Stripe-hosted onboarding link. The account id is stored (encrypted)
 * in oauth_connections (provider="stripe") — one connected account per builder,
 * reusable across their projects.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isProUser(supabase, user.id))) {
    return NextResponse.json({ error: "Accepting payments is a Pro feature.", code: "pro_required" }, { status: 403 });
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://onlyaiapp.com";

  try {
    let accountId: string | null = null;
    const { data: existing } = await supabase
      .from("oauth_connections")
      .select("access_token")
      .eq("user_id", user.id)
      .eq("provider", "stripe")
      .single();

    if (existing?.access_token) {
      try { accountId = await decrypt(existing.access_token as string); } catch { accountId = null; }
    }

    if (!accountId) {
      accountId = await createConnectedAccount();
      await supabase.from("oauth_connections").insert({
        user_id: user.id,
        provider: "stripe",
        access_token: await encrypt(accountId),
        metadata: { charges_enabled: false },
      });
    }

    const url = await createAccountLink(
      accountId,
      `${origin}/dashboard?connected=stripe`,
      `${origin}/dashboard`,
    );
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't start Stripe Connect." },
      { status: 400 },
    );
  }
}
