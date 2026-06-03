import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Implicit flow: Supabase returns tokens directly in the URL hash
        // (#access_token=...) instead of a PKCE code. No code verifier needed,
        // so there's no cross-storage mismatch. The browser client detects the
        // hash on the callback page and stores the session in cookies, making
        // it available to the server-side middleware on the next request.
        flowType: "implicit",
      },
    },
  );
}
