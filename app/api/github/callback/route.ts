import { decrypt, encrypt } from "@/lib/crypto";
import { getGithubUser } from "@/lib/github";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/github/callback
 * Handles GitHub OAuth callback — exchanges code for token, stores encrypted.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard?error=github_denied`);
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

  return NextResponse.redirect(`${origin}/dashboard?connected=github`);
}
