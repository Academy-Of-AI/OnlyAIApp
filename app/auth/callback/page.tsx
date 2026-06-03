"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * OAuth callback — implicit flow.
 *
 * With flowType: "implicit", Supabase returns tokens directly in the URL hash
 * (#access_token=...&refresh_token=...) rather than a PKCE code. The browser
 * client (createBrowserClient) automatically detects these on page load via
 * detectSessionInUrl, stores them in its cookie storage, and fires SIGNED_IN
 * on the auth state listener. No code exchange, no code verifier — no storage
 * mismatch possible.
 */
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get("next") ?? "/dashboard";
    const supabase = createClient();

    // Fast path: session already available (e.g. page re-render).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { router.replace(next); return; }
    });

    // Normal path: browser client detects tokens in URL hash and fires SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          router.replace(next);
        }
      },
    );

    // Fallback: if nothing happens in 10 s, something went wrong.
    const timeout = setTimeout(() => router.replace("/sign-in"), 10_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
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
