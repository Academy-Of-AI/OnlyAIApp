import { encrypt } from "@/lib/crypto";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function readCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(name + "="))
    ?.split("=")
    .slice(1)
    .join("=");
}

/**
 * GET /api/vercel/callback — the Vercel integration install redirect.
 *
 * Vercel sends ?code=…&configurationId=…&teamId=…&next=… here after the user
 * approves the install. We exchange the code for a long-lived integration access
 * token at api.vercel.com/v2/oauth/access_token (the integration endpoint — NOT
 * the SIWV /login/oauth/token one), then store it for this user. The user is
 * identified from the cookie set in /api/vercel/oauth (the install flow doesn't
 * round-trip a custom state param).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const teamId = searchParams.get("teamId");
  const configurationId = searchParams.get("configurationId");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/settings?error=vercel_denied`);
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const userId = readCookie(cookieHeader, "vercel_oauth_user");
  if (!userId) {
    // Lost the binding cookie (e.g. opened in another browser). Send them back
    // to retry rather than connecting to the wrong/no account.
    return NextResponse.redirect(`${origin}/settings?error=vercel_session_lost`);
  }

  // Exchange the code for an access token (integration OAuth endpoint).
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
    console.error("[vercel/callback] token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${origin}/settings?error=vercel_token`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    token_type?: string;
    installation_id?: string;
    user_id?: string;
    team_id?: string | null;
  };
  if (!tokenData.access_token) {
    return NextResponse.redirect(`${origin}/settings?error=vercel_token`);
  }

  // Best-effort display name (never blocks the connection).
  let username: string | undefined;
  try {
    const userRes = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const vu = (await userRes.json()) as { user?: { username?: string } };
    username = vu.user?.username;
  } catch { /* non-fatal */ }

  const supabase = await createClient();
  const encryptedToken = await encrypt(tokenData.access_token);

  await supabase.from("oauth_connections").upsert(
    {
      user_id: userId,
      provider: "vercel",
      access_token: encryptedToken,
      provider_user_id: tokenData.user_id ?? null,
      metadata: {
        username,
        installation_id: tokenData.installation_id,
        team_id: tokenData.team_id ?? teamId ?? null,
        configuration_id: configurationId ?? null,
      },
    },
    { onConflict: "user_id,provider" },
  );

  await track("vercel_connected", userId, { via: "integration" });

  // Return to where the connect started (e.g. the project, to auto-deploy).
  const nextCookie = readCookie(cookieHeader, "vercel_oauth_next");
  let dest = "/dashboard?connected=vercel";
  if (nextCookie) {
    try {
      const decoded = decodeURIComponent(nextCookie);
      if (decoded.startsWith("/") && !decoded.startsWith("//")) dest = decoded;
    } catch { /* keep default */ }
  }

  const res = NextResponse.redirect(`${origin}${dest}`);
  res.cookies.set("vercel_oauth_user", "", { maxAge: 0, path: "/" });
  res.cookies.set("vercel_oauth_next", "", { maxAge: 0, path: "/" });
  return res;
}
