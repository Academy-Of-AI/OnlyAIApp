import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * OAuth callback — server Route Handler.
 *
 * Both the OAuth initiation (sign-in/actions.ts) and this exchange use
 * createClient() from lib/supabase/server, which reads/writes cookies via
 * next/headers. This means:
 * - The PKCE verifier stored during signInWithOAuth (via Set-Cookie on the
 *   redirect) is in request.cookies here — same format, guaranteed found.
 * - The session is written to cookies in the same server format the
 *   middleware reads, so new tabs are authenticated immediately.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/sign-in`);
}
