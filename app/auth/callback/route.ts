import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Email-link OTP types Supabase delivers via ?type=. Kept as a local literal
// list (rather than importing EmailOtpType, which isn't re-exported from the
// supabase-js entry bundle) so we also validate the value at runtime.
const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;
type OtpType = (typeof OTP_TYPES)[number];
function asOtpType(value: string | null): OtpType | null {
  return value && (OTP_TYPES as readonly string[]).includes(value) ? (value as OtpType) : null;
}

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

/** Only allow same-origin, local-path redirects (defense against open redirect). */
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = asOtpType(searchParams.get("type"));
  const next = safeNext(searchParams.get("next"));

  // PKCE magic links / OAuth: exchange the ?code= for a session.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(
      `${origin}/sign-in?auth_error=${encodeURIComponent(error.message)}`,
    );
  }

  // Non-PKCE email links deliver a token_hash + type — verify via verifyOtp.
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[auth/callback] verifyOtp failed:", error.message);
    return NextResponse.redirect(
      `${origin}/sign-in?auth_error=${encodeURIComponent(error.message)}`,
    );
  }

  // No code and no token_hash — nothing to exchange.
  return NextResponse.redirect(
    `${origin}/sign-in?auth_error=${encodeURIComponent("Sign-in link was invalid or expired.")}`,
  );
}
