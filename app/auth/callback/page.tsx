"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * OAuth callback — implicit flow.
 *
 * Flow:
 * 1. Supabase redirects here with #access_token=...&refresh_token=... in the URL hash.
 * 2. The browser Supabase client detects the tokens (detectSessionInUrl: true default).
 * 3. We read the session and POST it to /api/auth/set-session — a server route that
 *    explicitly writes the cookies in the canonical server format onto its response.
 * 4. The browser receives those Set-Cookie headers and stores them.
 * 5. We redirect to /dashboard. All subsequent requests carry the server-format cookies
 *    so the middleware validates the session correctly in every tab.
 */
function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get("next") ?? "/dashboard";
    const supabase = createClient();

    async function handleSession() {
      // Give the browser client a moment to parse the URL hash and set the session.
      const { data: { session }, error } = await supabase.auth.getSession();

      if (!session || error) {
        console.error("[callback] no session detected", error?.message);
        router.replace("/sign-in");
        return;
      }

      // Ask the server to set cookies in the format its middleware expects,
      // so the session persists across new tabs and refreshes.
      try {
        await fetch("/api/auth/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });
      } catch (e) {
        console.warn("[callback] set-session fetch failed:", e);
        // Non-fatal: browser-client cookies might still work.
      }

      router.replace(next);
    }

    // The browser client fires SIGNED_IN when it detects the URL hash tokens.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          handleSession();
        }
      },
    );

    // Fast path: session already available synchronously.
    handleSession();

    const timeout = setTimeout(() => router.replace("/sign-in"), 12_000);
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
