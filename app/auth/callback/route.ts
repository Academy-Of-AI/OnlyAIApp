import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieEntry = Parameters<NonNullable<CookieMethodsServer["setAll"]>>[0][number];

/**
 * OAuth callback — exchanges the PKCE code for a session and durably persists
 * the session cookie in the browser.
 *
 * Cookie strategy (why both request AND response):
 * During exchangeCodeForSession the Supabase SDK may call getAll() after
 * setAll() to read back the just-stored session. If setAll() only writes to
 * response.cookies, subsequent getAll() calls (which read request.cookies)
 * won't see the new tokens and the exchange silently "fails to remember" the
 * session. Writing to request.cookies too keeps the in-memory state consistent
 * for the duration of this handler, while writing to response.cookies is what
 * actually sets the Set-Cookie header the browser receives.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (toSet: CookieEntry[]) =>
            toSet.forEach(({ name, value, options }) => {
              // Keep request-side state consistent for any read-after-write
              // inside the SDK during this handler.
              request.cookies.set(name, value);
              // This is what actually sends Set-Cookie to the browser.
              response.cookies.set(name, value, options);
            }),
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;

    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  return NextResponse.redirect(`${origin}/sign-in`);
}
