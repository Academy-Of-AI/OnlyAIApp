import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/github/connect
 * Redirects user to GitHub OAuth authorization page.
 * After approval, GitHub redirects to /api/github/callback
 *
 * CSRF protection: we generate a random `state`, send it to GitHub, and also
 * persist it in an httpOnly, secure, short-lived cookie. The callback REQUIRES
 * the returned state to equal the cookie — otherwise an attacker could complete
 * the OAuth dance and overwrite the victim's connection (connection fixation).
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const isLocal = origin.startsWith("http://localhost") || origin.startsWith("http://127.");
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${origin}/api/github/callback`,
    scope: "repo user:email",
    state,
  });

  const res = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`,
  );

  // Persist the state in an httpOnly, secure, short-lived cookie so the callback
  // can require an exact match. Not readable by JS; expires quickly.
  (await cookies()).set("github_oauth_state", state, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes — long enough to authorize, short-lived.
  });

  return res;
}
