import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * OAuth callback.
 *
 * Cookie strategy — why both cookieStore AND redirectResponse:
 *
 * The Supabase SDK internally calls getAll() AFTER setAll() during
 * exchangeCodeForSession to confirm what was just stored. We need those reads
 * to see the freshly written tokens, so we write to cookieStore (mutable
 * in-memory store for this request) for consistency, AND to redirectResponse
 * (the actual HTTP response) so the browser actually receives the Set-Cookie
 * header. Without the redirectResponse write, Next.js cookies() mutations may
 * not attach to a manually returned NextResponse — leaving the browser with no
 * session cookie and requiring re-login on every new tab.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const redirectResponse = NextResponse.redirect(`${origin}${next}`);

  if (!code) return redirectResponse;

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read from the full incoming cookie store — includes the PKCE
        // code-verifier cookie set by the browser client during signInWithOAuth.
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) => {
            // Write to in-memory store so any read-after-write during the
            // exchange sees the new value.
            cookieStore.set(name, value, options);
            // Write to the response so the browser actually gets the cookie.
            redirectResponse.cookies.set(name, value, options);
          }),
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  return redirectResponse;
}
