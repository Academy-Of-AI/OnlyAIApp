"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * OAuth callback — handled CLIENT-SIDE.
 *
 * Why client-side instead of a server Route Handler:
 * The browser's Supabase client (createBrowserClient) stores the PKCE code
 * verifier in its own cookie jar during signInWithOAuth. That same client must
 * be the one to call exchangeCodeForSession so it can read back the verifier
 * it stored. A server-side handler uses a different client (createServerClient)
 * that reads from next/headers cookies — there's a storage mismatch that causes
 * "code verifier not found" on every attempt. Letting the browser client handle
 * its own callback sidesteps this entirely.
 */
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";

    if (!code) {
      router.replace("/sign-in");
      return;
    }

    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.error("[callback] exchange failed:", error.message);
        router.replace(`/sign-in?auth_error=${encodeURIComponent(error.message)}`);
      } else {
        router.replace(next);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950">
      <p className="text-neutral-400 text-sm animate-pulse">Signing in…</p>
    </main>
  );
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
