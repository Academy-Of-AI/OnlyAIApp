import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { isProUser, apiLimit, currentApiPeriod } from "@/lib/plan";
import { bearerFromRequest, hashToken } from "./tokens";

/**
 * The ONE door to every Pilot-API tool. The CLI, a future MCP shim, and the
 * website all call this — there is no other way to reach a tool, so the
 * entitlement guarantee can't be bypassed per-transport.
 *
 * On EVERY call: valid token → live Pro plan (profiles.plan, kept current by the
 * Stripe webhook) → under the monthly fair-use cap. This is what makes billing
 * CONTINUOUS: a lapsed/cancelled plan stops working on the very next call, and
 * the valuable logic only ever runs here (server-side), so there's nothing to run
 * offline. Returns a typed allow/deny — never throws.
 */
export type GateAllow = {
  ok: true;
  admin: SupabaseClient;
  userId: string;
  used: number;   // calls already spent this period
  limit: number;  // monthly cap for this plan
};
export type GateDeny = { ok: false; status: number; code: string; message: string };
export type GateResult = GateAllow | GateDeny;

const deny = (status: number, code: string, message: string): GateDeny => ({ ok: false, status, code, message });

export async function requireProApiCaller(req: Request): Promise<GateResult> {
  const token = bearerFromRequest(req);
  if (!token) {
    return deny(401, "no_token", "Connect with your OnlyAI Pro account — run `pilot login <token>` (get a token at onlyaiapp.com/settings).");
  }

  let admin: SupabaseClient;
  try { admin = await createAdminClient(); }
  catch { return deny(503, "unavailable", "Pilot is briefly unavailable — please try again."); }

  // Look up by HASH — a usable token is never stored or compared in plaintext.
  const { data: row } = await admin
    .from("api_tokens")
    .select("id,user_id,revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!row || row.revoked_at) {
    return deny(401, "bad_token", "That token isn't valid (or was revoked). Generate a new one at onlyaiapp.com/settings.");
  }

  // Live plan check — single source of truth (profiles.plan, Stripe-synced).
  if (!(await isProUser(admin, row.user_id))) {
    return deny(402, "pro_required", "Your OnlyAI Pro plan is inactive — renew at onlyaiapp.com/upgrade to keep using Pilot.");
  }

  // Fair-use: count this period's calls (metadata-only ledger).
  const period = currentApiPeriod();
  const { count } = await admin
    .from("api_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", row.user_id)
    .eq("period", period);
  const used = count ?? 0;
  const limit = apiLimit("pro");
  if (used >= limit) {
    return deny(429, "limit_reached", `You've used all ${limit} Pilot runs this month — resets on the 1st. (Reply if you need a higher cap.)`);
  }

  // Best-effort last-used stamp (never blocks the call).
  try { await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id); } catch { /* non-fatal */ }

  return { ok: true, admin, userId: row.user_id, used, limit };
}

/** Record one tool call in the metadata-only ledger. Best-effort — a failed
 *  write must not fail the user's call (worst case: they got a free run). */
export async function recordApiUsage(
  admin: SupabaseClient,
  userId: string,
  tool: string,
  costUsd = 0,
): Promise<void> {
  try {
    await admin.from("api_usage").insert({ user_id: userId, tool, period: currentApiPeriod(), cost_usd: costUsd });
  } catch { /* non-fatal */ }
}
