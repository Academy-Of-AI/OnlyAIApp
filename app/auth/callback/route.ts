import { createAdminClient, createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { getGithubUser } from "@/lib/github";
import { NextResponse } from "next/server";

/** Outcome of the GitHub bridge: conflict=true means this GitHub already belongs
 *  to a DIFFERENT account, so the caller should route the user to it rather than
 *  strand them in a duplicate workspace. */
type BridgeResult = { conflict: boolean; existingEmail?: string | null };

/**
 * Bridge a GitHub OAuth sign-in into a usable connection AND enforce the
 * one-GitHub-one-account rule at the front door.
 *
 * The provider_token (the GitHub access token) is only present on the session
 * right after the code exchange, so we capture it HERE and store it in
 * oauth_connections — exactly like /api/github/connect does — so "Continue with
 * GitHub" both signs the user in AND grants the repo access they need to
 * provision. Without this, a GitHub-signed-in user is still told to "Connect
 * GitHub" (oauth_connections is empty).
 *
 * Identity guard: we ALSO bind profiles.github_id here (at sign-in) instead of
 * lazily at first build. Binding early — keyed on GitHub's unique numeric id,
 * not on email — is what makes "1 GitHub = 1 account" hold even when GitHub's
 * email is private and Supabase can't auto-link by email. If this GitHub id is
 * already owned by another account, we DON'T mint a parallel workspace: we
 * return conflict so the caller sends them to their existing account, turning
 * the old build-time `github_taken` dead-end into a self-healing redirect.
 *
 * Best-effort otherwise: never blocks a clean sign-in.
 */
async function bridgeGithubToken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: { provider_token?: string | null; user?: { id?: string } | null } | null,
): Promise<BridgeResult> {
  const providerToken = session?.provider_token ?? null;
  const userId = session?.user?.id ?? null;
  if (!providerToken || !userId) return { conflict: false };
  try {
    const { login, id: ghId } = await getGithubUser(providerToken);

    // Front-door collision check. The user-scoped client can only see its OWN
    // profile (RLS), so use an admin client to look across accounts. If this
    // GitHub id is bound to a different user, stop here — don't write anything.
    if (ghId) {
      const admin = await createAdminClient();
      const { data: owner } = await admin
        .from("profiles").select("id, email").eq("github_id", ghId).maybeSingle();
      if (owner && owner.id !== userId) {
        return { conflict: true, existingEmail: (owner.email as string | null) ?? null };
      }
    }

    const encrypted = await encrypt(providerToken);
    await supabase.from("oauth_connections").upsert({
      user_id: userId,
      provider: "github",
      access_token: encrypted,
      provider_user_id: String(ghId),
      metadata: { login },
    });
    // Bind the identity now (username + the unique numeric id that enforces the
    // rule). Pre-checked above, so the unique index won't reject under normal flow.
    await supabase.from("profiles")
      .update({ github_username: login, github_id: ghId }).eq("id", userId);
    return { conflict: false };
  } catch (e) {
    console.warn("[auth/callback] GitHub token bridge failed (non-fatal):", e);
    return { conflict: false };
  }
}

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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // One click = signed in + repo access ready (no second "Connect GitHub").
      const bridge = await bridgeGithubToken(supabase, data?.session ?? null)
        .catch(() => ({ conflict: false } as BridgeResult));
      if (bridge.conflict) {
        // This GitHub already belongs to an earlier account. Don't leave them in
        // a fresh duplicate — sign this session out and point them at their real
        // account, where their projects already live.
        await supabase.auth.signOut().catch(() => {});
        const msg = bridge.existingEmail
          ? `This GitHub is already linked to your earlier account (${bridge.existingEmail}). Sign in with that email — your projects are there.`
          : "This GitHub is already linked to another OnlyAIApp account. Sign in with the email you first used.";
        return NextResponse.redirect(`${origin}/sign-in?auth_error=${encodeURIComponent(msg)}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
    // The #1 magic-link failure: the link opened in a DIFFERENT browser/app than
    // the one it was requested from, so the PKCE verifier cookie isn't here.
    // Don't show the raw "code verifier" error — guide them.
    const friendly = /verifier|code challenge|pkce|flow state/i.test(error.message)
      ? "Open the sign-in link in the same browser you requested it from — or just use “Continue with GitHub”, it’s instant."
      : "That sign-in link didn’t work (it may have expired). Request a new one, or use “Continue with GitHub”.";
    return NextResponse.redirect(
      `${origin}/sign-in?auth_error=${encodeURIComponent(friendly)}`,
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
      `${origin}/sign-in?auth_error=${encodeURIComponent("That sign-in link has expired or was already used. Request a new one, or use “Continue with GitHub”.")}`,
    );
  }

  // No code and no token_hash — nothing to exchange.
  return NextResponse.redirect(
    `${origin}/sign-in?auth_error=${encodeURIComponent("Sign-in link was invalid or expired.")}`,
  );
}
