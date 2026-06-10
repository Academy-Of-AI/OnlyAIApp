import { decrypt, encrypt } from "@/lib/crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Return a VALID Supabase Management token + org for a user — transparently
 * refreshing a short-lived OAuth token when it's near expiry. Backward
 * compatible: a legacy personal-access-token (token-paste) connection has no
 * refresh_token/expires_at, so it's returned as-is (those tokens don't expire).
 * Returns null if the user has no Supabase connection.
 */
export async function getSupabaseConn(
  db: SupabaseClient,
  userId: string,
): Promise<{ token: string; orgId?: string } | null> {
  const { data: conn } = await db
    .from("oauth_connections")
    .select("access_token, metadata")
    .eq("user_id", userId)
    .eq("provider", "supabase")
    .single();
  if (!conn?.access_token) return null;

  const meta = (conn.metadata ?? {}) as {
    org_id?: string; refresh_token?: string | null; expires_at?: number | null;
  };

  let token: string;
  try { token = await decrypt(conn.access_token as string); } catch { return null; }

  const expiresAt = typeof meta.expires_at === "number" ? meta.expires_at : null;
  const refreshEnc = meta.refresh_token ?? null;

  // Refresh only OAuth connections that are within 60s of expiry.
  if (expiresAt && refreshEnc && Date.now() > expiresAt - 60_000 && process.env.SUPABASE_OAUTH_CLIENT_ID) {
    try {
      const refreshToken = await decrypt(refreshEnc);
      const basic = Buffer.from(
        `${process.env.SUPABASE_OAUTH_CLIENT_ID}:${process.env.SUPABASE_OAUTH_CLIENT_SECRET}`,
      ).toString("base64");
      const r = await fetch("https://api.supabase.com/v1/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
      });
      if (r.ok) {
        const t = await r.json() as { access_token?: string; refresh_token?: string; expires_in?: number };
        if (t.access_token) {
          token = t.access_token;
          await db.from("oauth_connections")
            .update({
              access_token: await encrypt(token),
              metadata: {
                ...meta,
                refresh_token: t.refresh_token ? await encrypt(t.refresh_token) : refreshEnc,
                expires_at: t.expires_in ? Date.now() + t.expires_in * 1000 : expiresAt,
              },
            })
            .eq("user_id", userId).eq("provider", "supabase");
        }
      }
    } catch { /* fall back to the existing token; the caller surfaces any failure */ }
  }

  return { token, orgId: meta.org_id };
}
