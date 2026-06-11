import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * GET /api/supabase/oauth
 * One-click "Connect Supabase" — redirects to Supabase to authorize, so the
 * user's app database is provisioned in THEIR own Supabase org (they own it),
 * no token paste. Mirrors the Vercel OAuth flow. `next` returns where started.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/sign-in`);

  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID;
  if (!clientId) {
    // Not configured — degrade to the token-paste fallback instead of a 500.
    return NextResponse.redirect(`${origin}/settings?error=supabase_oauth_unconfigured`);
  }

  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard?connected=supabase";

  const state = `${user.id}:${randomBytes(16).toString("hex")}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/supabase/oauth/callback`,
    response_type: "code",
    state,
  });

  const response = NextResponse.redirect(`https://api.supabase.com/v1/oauth/authorize?${params.toString()}`);
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  response.cookies.set("supabase_oauth_state", state, opts);
  response.cookies.set("supabase_oauth_next", encodeURIComponent(next), opts);
  // Bind the user the same resilient way the Vercel flow does — an httpOnly
  // cookie the callback reads back, instead of a brittle state exact-match.
  response.cookies.set("supabase_oauth_user", user.id, opts);
  return response;
}
