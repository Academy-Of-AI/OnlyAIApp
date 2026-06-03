import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

type CookieEntry = { name: string; value: string; options?: Record<string, unknown> };

/**
 * POST /api/auth/set-session
 * Called by the client-side callback page after it detects the implicit-flow
 * session in the URL hash. The browser client stores tokens in its own cookie
 * jar, but the format may differ from what the server middleware expects.
 * Calling setSession() here lets the server-side Supabase client write the
 * session in its own canonical format, attached directly to the JSON response —
 * so all subsequent requests (new tabs, refreshes) carry the correct cookies
 * that the middleware can validate.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    access_token?: string;
    refresh_token?: string;
  };

  const { access_token, refresh_token } = body;
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "missing tokens" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [],
        // Write session cookies directly onto the response so the browser
        // receives them as Set-Cookie headers in the canonical server format.
        setAll: (toSet: CookieEntry[]) =>
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]),
          ),
      },
    },
  );

  await supabase.auth.setSession({ access_token, refresh_token });
  return response;
}
