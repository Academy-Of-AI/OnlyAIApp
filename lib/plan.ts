import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Is this user on Pro? The AI-powered rails (auto-capture digest, drift,
 * plan generation, weekly retro) run on the OWNER's Anthropic key, so they
 * are Pro-gated — that keeps owner AI cost on paying users only. Free users
 * still get the handoff + manual memory/plan/CLAUDE.md sync (no LLM).
 */
export async function isProUser(db: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data } = await db.from("profiles").select("plan").eq("id", userId).single();
    return data?.plan === "pro";
  } catch {
    return false;
  }
}

export const PRO_REQUIRED = {
  error: "This is a Pro feature. Upgrade to unlock your Portfolio, AI career artifacts, and advanced build tracking.",
  code: "pro_required",
} as const;

/* ── Tiers ───────────────────────────────────────────────────────────────
   free  — 2 projects, can't delete (anti-recycle). +1 per successful referral.
   core  — $8/mo · 8 projects · delete/recreate.
   pro   — $17/mo (yearly −30%) · 8 projects · Portfolio + career artifacts + Pilot. */
export type PlanTier = "free" | "core" | "pro";

export const PROJECT_LIMITS: Record<PlanTier, number> = { free: 2, core: 8, pro: 8 };

/** Monthly AI-written career artifacts per tier. (Instant templates are unlimited & free.) */
export const ARTIFACT_LIMITS: Record<PlanTier, number> = { free: 3, core: 15, pro: Infinity };
export function artifactLimit(plan: string | null | undefined): number {
  return ARTIFACT_LIMITS[normalizePlan(plan)];
}

export function normalizePlan(plan: string | null | undefined): PlanTier {
  return plan === "pro" ? "pro" : plan === "core" ? "core" : "free";
}

/** Has the user opted in to product updates (WhatsApp + marketing consent)? Used to gate the nudge. */
export function hasOptedIn(
  profile: { phone?: string | null; marketing_consent?: boolean | null } | null | undefined,
): boolean {
  return !!(profile?.marketing_consent && profile?.phone && String(profile.phone).trim().length > 0);
}

/**
 * How many projects this user may provision.
 * Base per tier + 1 per successful referral (bonus_projects, granted when a
 * referee ships their first app).
 */
export function projectLimit(plan: string | null | undefined, bonusProjects: number = 0): number {
  return PROJECT_LIMITS[normalizePlan(plan)] + Math.max(0, bonusProjects | 0);
}

/** Free users can't delete their project (so they can't recycle the slot). */
export function canDeleteProjects(plan: string | null | undefined): boolean {
  return normalizePlan(plan) !== "free";
}

/** Custom domains are available on Core + Pro (not Free). Unadvertised perk. */
export function canUseDomains(plan: string | null | undefined): boolean {
  return normalizePlan(plan) !== "free";
}

/** Detect how production-hardened an app is, from its env-var keys. */
export function hardeningOf(keys: Iterable<string>): { payments: boolean; monitoring: boolean; hardened: boolean } {
  const set = keys instanceof Set ? keys : new Set(keys);
  const payments = set.has("STRIPE_SECRET_KEY");
  const monitoring = set.has("SENTRY_DSN") || set.has("NEXT_PUBLIC_POSTHOG_KEY") || set.has("UPSTASH_REDIS_REST_URL");
  return { payments, monitoring, hardened: payments || monitoring };
}
