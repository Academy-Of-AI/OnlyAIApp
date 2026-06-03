import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type CookieEntry = { name: string; value: string; options?: Record<string, unknown> };

/**
 * OAuth / magic-link callback. Exchanges the code for a session and — crucially —
 * writes the session cookies onto the SAME redirect response we return, so they
 * actually reach the browser and persist across tabs and refreshes.
 *
 * The previous version returned a fresh NextResponse.redirect() while the session
 * cookies were written to the implicit next/headers cookie store; those don't
 * reliably attach to a hand-made redirect, so the cookie never durably landed —
 * the login "stuck" only in the originating tab (in-memory) and any new tab was
 * logged out. Attaching cookies to `response` fixes that.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const response = NextResponse.redirect(`${origin}${next}`);
  if (!code) return response;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read the PKCE code-verifier (and any existing cookies) from the request…
        getAll: () => cookieStore.getAll(),
        // …but write the new session cookies onto the response we return.
        setAll: (toSet: CookieEntry[]) =>
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          ),
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth`);
  }
  return response;
}
