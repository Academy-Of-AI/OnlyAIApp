"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Only honor same-origin, local-path post-login redirects (defense against
 * open redirect). Falls back to /dashboard.
 */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

/**
 * Server Action — initiates GitHub OAuth via the SERVER client.
 *
 * This is the canonical Supabase App Router approach. By calling
 * signInWithOAuth from the server:
 * - The PKCE code verifier is stored in server-format cookies
 *   (via next/headers cookies(), included in the redirect response
 *   as Set-Cookie headers).
 * - When GitHub redirects back to /auth/callback, the Route Handler
 *   uses the same createClient() server client, finds the verifier
 *   in request.cookies, and the exchange succeeds.
 * - Session is stored in the same server-format cookies the middleware
 *   validates — so every new tab just works.
 *
 * Using the browser client (createBrowserClient) to initiate OAuth
 * stored the verifier in localStorage/browser-cookies in a different
 * format than the server callback expected — causing "PKCE verifier
 * not found" every time.
 */
export async function signInWithGitHub(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const headerStore = await headers();
  // Prefer the forwarded host so it works on both onlyaiapp.com and previews.
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "onlyaiapp.com";
  // localhost is plain http in dev; everything else is https.
  const isLocal = host.startsWith("localhost") || host.startsWith("127.");
  const proto = headerStore.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    console.error("[auth] signInWithOAuth error:", error.message);
    redirect("/sign-in?auth_error=" + encodeURIComponent(error.message));
  }

  if (data.url) {
    redirect(data.url);
  }
}

/**
 * Server Action — passwordless email sign-in (magic link). Lets people in
 * WITHOUT GitHub so they can explore; GitHub is requested later, at build time.
 * Reuses /auth/callback (generic code exchange).
 */
export async function signInWithEmail(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    redirect("/sign-in?auth_error=" + encodeURIComponent("Enter a valid email address."));
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "onlyaiapp.com";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.");
  const proto = headerStore.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error) {
    // Don't show raw Supabase/SMTP errors to non-technical users — show a
    // friendly fallback that points them at GitHub (which never needs email).
    console.error("[auth] signInWithEmail error:", error.message);
    redirect("/sign-in?email_error=1");
  }

  redirect("/sign-in?sent=" + encodeURIComponent(email));
}
