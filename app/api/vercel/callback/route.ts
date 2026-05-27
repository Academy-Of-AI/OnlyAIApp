import { encrypt } from "@/lib/crypto";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/vercel/callback
 * Handles Vercel OAuth callback — exchanges code for token, stores encrypted.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(`${origin}/dashboard?error=vercel_denied`);
  }

  // Validate CSRF state cookie
  const cookieHeader = request.headers.get("cookie") ?? "";
  const storedState = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("vercel_oauth_state="))
    ?.split("=")[1];

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${origin}/dashboard?error=vercel_state_mismatch`);
  }

  // Extract userId from state (format: "userId:nonce")
  const userId = state.split(":")[0];

  // Exchange code for access token
  const tokenRes = await fetch("https://api.vercel.com/v2/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.VERCEL_OAUTH_CLIENT_ID!,
      client_secret: process.env.VERCEL_OAUTH_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/vercel/callback`,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[vercel/callback] token exchange failed", await tokenRes.text());
    return NextResponse.redirect(`${origin}/dashboard?error=vercel_token`);
  }

  const tokenData = await tokenRes.json() as {
    access_token: string;
    token_type: string;
    installation_id?: string;
    user_id?: string;
    team_id?: string | null;
  };

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${origin}/dashboard?error=vercel_token`);
  }

  // Get Vercel user info
  const userRes = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const vercelUser = await userRes.json() as { user?: { id: string; username: string } };

  // Store encrypted token
  const supabase = await createClient();
  const encryptedToken = await encrypt(tokenData.access_token);

  await supabase.from("oauth_connections").upsert({
    user_id: userId,
    provider: "vercel",
    access_token: encryptedToken,
    provider_user_id: vercelUser.user?.id ?? tokenData.user_id,
    metadata: {
      username: vercelUser.user?.username,
      installation_id: tokenData.installation_id,
      team_id: tokenData.team_id ?? null,
    },
  });

  await track("vercel_connected", userId, {
    vercel_username: vercelUser.user?.username,
    via: "oauth",
  });

  // Clear CSRF cookie
  const redirectRes = NextResponse.redirect(`${origin}/dashboard?connected=vercel`);
  redirectRes.cookies.set("vercel_oauth_state", "", { maxAge: 0, path: "/" });
  return redirectRes;
}
