import { decrypt, encrypt } from "@/lib/crypto";
import { getGithubUser } from "@/lib/github";
import { track } from "@/lib/analytics";
import { attributeReferral } from "@/lib/referrals";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/github/callback
 * Handles GitHub OAuth callback — exchanges code for token, stores encrypted.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const returnedState = searchParams.get("state");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard?error=github_denied`);
  }

  // CSRF: the state returned by GitHub MUST match the httpOnly cookie we set in
  // /api/github/connect. A mismatch (or missing cookie) means the request did
  // not originate from our connect flow — reject to prevent connection fixation
  // / account-overwrite. Clear the single-use cookie regardless of outcome.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("github_oauth_state")?.value;
  cookieStore.set("github_oauth_state", "", { maxAge: 0, path: "/" });

  if (!expectedState || !returnedState || returnedState !== expectedState) {
    return NextResponse.redirect(`${origin}/dashboard?error=github_state`);
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${origin}/dashboard?error=github_token`);
  }

  // Get GitHub user info
  const { login, id } = await getGithubUser(tokenData.access_token);

  // Store encrypted token
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/sign-in`);

  const encryptedToken = await encrypt(tokenData.access_token);

  await supabase.from("oauth_connections").upsert({
    user_id: user.id,
    provider: "github",
    access_token: encryptedToken,
    provider_user_id: String(id),
    metadata: { login },
  });

  await supabase
    .from("profiles")
    .update({ github_username: login })
    .eq("id", user.id);

  await track("github_connected", user.id, { github_login: login });

  // Referral attribution — if they arrived via /r/[code], record it once, then clear the cookie.
  const ref = (await cookies()).get("ref")?.value;
  if (ref) await attributeReferral(user.id, ref);

  const res = NextResponse.redirect(`${origin}/dashboard?connected=github`);
  if (ref) res.cookies.set("ref", "", { maxAge: 0, path: "/" });
  return res;
}
