import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * URL Slug of the Vercel integration (created in the Integration Console).
 * Overridable via env so it can change without a code edit; defaults to the
 * slug we registered.
 */
const VERCEL_INTEGRATION_SLUG = process.env.VERCEL_INTEGRATION_SLUG || "onlyaiapp";

/**
 * GET /api/vercel/oauth — start the Vercel integration install flow.
 *
 * Vercel *integrations* are installed at vercel.com/integrations/<slug>/new
 * (NOT the Sign-in-with-Vercel /oauth/authorize endpoint — that one is
 * identity-only and can't deploy). After the user approves, Vercel redirects to
 * the integration's registered Redirect URL (/api/vercel/callback) with
 * ?code=…&configurationId=…&teamId=…&next=…
 *
 * The install flow does NOT round-trip a custom `state`, so we bind the user by
 * stashing their id in an httpOnly cookie here and reading it back in the
 * callback.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/sign-in`);

  // Not configured yet → settings (where the paste-token fallback + honest copy live).
  if (!process.env.VERCEL_OAUTH_CLIENT_ID) {
    return NextResponse.redirect(`${origin}/settings?error=vercel_oauth_unconfigured`);
  }

  // Where to return after connecting (e.g. back to the project to auto-deploy).
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/dashboard?connected=vercel";

  const response = NextResponse.redirect(
    `https://vercel.com/integrations/${VERCEL_INTEGRATION_SLUG}/new`,
  );

  const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  response.cookies.set("vercel_oauth_user", user.id, cookieOpts);
  response.cookies.set("vercel_oauth_next", encodeURIComponent(next), cookieOpts);
  return response;
}
