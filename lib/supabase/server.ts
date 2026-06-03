import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cookieDomainFor } from "@/lib/supabase/cookie-domain";

type CookieEntry = { name: string; value: string; options?: Record<string, unknown> };

/**
 * Service-role client — bypasses RLS.
 * Only use in trusted server-side contexts (webhooks, cron jobs).
 * Never expose to the browser or return raw data from it.
 */
export async function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function createClient() {
  const cookieStore = await cookies();
  let domain: string | undefined;
  try { domain = cookieDomainFor((await headers()).get("host")); } catch { /* headers() unavailable */ }
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: CookieEntry[]) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, domain ? { ...options, domain } : options),
            );
          } catch {}
        },
      },
    },
  );
}
