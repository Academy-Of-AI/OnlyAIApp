"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
export async function signInWithGitHub() {
  const headerStore = await headers();
  // Prefer the forwarded host so it works on both onlyaiapp.com and previews.
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "onlyaiapp.com";
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
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
