import { encrypt } from "@/lib/crypto";
import { listOrganizations } from "@/lib/supabase-mgmt";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/supabase/callback
 * Supabase OAuth callback — exchanges the code for an access (+ refresh) token,
 * resolves the authorized org, stores it encrypted. Provisioning then creates
 * the user's app database in their OWN org. Refresh token + expiry are stored
 * (in metadata) so getSupabaseConn() can refresh the short-lived token later.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  if (error || !code || !state) return NextResponse.redirect(`${origin}/dashboard?error=supabase_denied`);

  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = (name: string) =>
    cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="))?.split("=").slice(1).join("=");

  const storedState = cookie("supabase_oauth_state");
  if (!storedState || storedState !== state) return NextResponse.redirect(`${origin}/dashboard?error=supabase_state`);

  const userId = state.split(":")[0];

  // Exchange the code for tokens (HTTP Basic with the OAuth app credentials).
  const basic = Buffer.from(
    `${process.env.SUPABASE_OAUTH_CLIENT_ID}:${process.env.SUPABASE_OAUTH_CLIENT_SECRET}`,
  ).toString("base64");
  const tokenRes = await fetch("https://api.supabase.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/supabase/callback`,
    }),
  });
  if (!tokenRes.ok) {
    console.error("[supabase/callback] token exchange failed", await tokenRes.text());
    return NextResponse.redirect(`${origin}/dashboard?error=supabase_token`);
  }
  const tok = await tokenRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!tok.access_token) return NextResponse.redirect(`${origin}/dashboard?error=supabase_token`);

  // The OAuth token is scoped to the org the user authorized — resolve it.
  let org: { id: string; name: string } | undefined;
  try { org = (await listOrganizations(tok.access_token))[0]; } catch { /* org resolved at provision time if needed */ }

  const supabase = await createClient();
  const accessEnc = await encrypt(tok.access_token);
  const refreshEnc = tok.refresh_token ? await encrypt(tok.refresh_token) : null;
  const expiresAt = tok.expires_in ? Date.now() + tok.expires_in * 1000 : null;

  await supabase.from("oauth_connections").upsert({
    user_id: userId,
    provider: "supabase",
    access_token: accessEnc,
    metadata: { org_id: org?.id, org_name: org?.name, refresh_token: refreshEnc, expires_at: expiresAt, via: "oauth" },
  });

  await track("supabase_connected", userId, { org: org?.name, via: "oauth" });

  // Return to where the connect started (e.g. onboarding / a project).
  let dest = "/dashboard?connected=supabase";
  const nextCookie = cookie("supabase_oauth_next");
  if (nextCookie) {
    try { const d = decodeURIComponent(nextCookie); if (d.startsWith("/") && !d.startsWith("//")) dest = d; } catch { /* default */ }
  }
  const res = NextResponse.redirect(`${origin}${dest}`);
  res.cookies.set("supabase_oauth_state", "", { maxAge: 0, path: "/" });
  res.cookies.set("supabase_oauth_next", "", { maxAge: 0, path: "/" });
  return res;
}
