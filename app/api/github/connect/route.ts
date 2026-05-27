import { NextResponse } from "next/server";

/**
 * GET /api/github/connect
 * Redirects user to GitHub OAuth authorization page.
 * After approval, GitHub redirects to /api/github/callback
 */
export function GET(request: Request) {
  const { origin } = new URL(request.url);
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${origin}/api/github/callback`,
    scope: "repo user:email",
    state: crypto.randomUUID(),
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`,
  );
}
