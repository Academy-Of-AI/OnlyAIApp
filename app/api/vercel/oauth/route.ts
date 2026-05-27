import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * GET /api/vercel/oauth
 * Initiates the Vercel OAuth flow — redirects user to Vercel to authorize.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.VERCEL_OAUTH_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Vercel OAuth not configured" }, { status: 500 });

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

  // Store state in a short-lived cookie for CSRF validation
  response.cookies.set("vercel_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
