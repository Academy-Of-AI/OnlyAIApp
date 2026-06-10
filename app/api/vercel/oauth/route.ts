import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * GET /api/vercel/oauth
 * Initiates the Vercel OAuth flow — redirects user to Vercel to authorize.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/sign-in`);

  const clientId = process.env.VERCEL_OAUTH_CLIENT_ID;
  if (!clientId) {
    // Not configured — degrade gracefully (the connect UI still offers the
    // token-paste fallback) instead of dumping a JSON 500 on the user.
    return NextResponse.redirect(`${origin}/dashboard?error=vercel_oauth_unconfigured`);
  }

  // Where to return after connecting (e.g. back to the project to auto-deploy).
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard?connected=vercel";

  // CSRF state: userId + random nonce, stored in cookie
  const state = `${user.id}:${randomBytes(16).toString("hex")}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/vercel/callback`,
    state,
  });

  const response = NextResponse.redirect(
    `https://vercel.com/oauth/authorize?${params.toString()}`
  );

  const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  response.cookies.set("vercel_oauth_state", state, cookieOpts);
  response.cookies.set("vercel_oauth_next", encodeURIComponent(next), cookieOpts);

  return response;
}
