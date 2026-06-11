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
   free  — 1 active project, CAN delete/recreate (owner-AI is metered by
           build_credits, so recycling can't farm anything — no need to trap the
           slot). The first 50 builders get a +1 early-adopter bonus (=> 2). +1
           per successful referral on top.
   core  — $8/mo · 8 projects · unlimited* Plan Packs.
   pro   — $17/mo (yearly −30%) · 8 projects · Portfolio + career artifacts + Pilot.
   *Core/Pro Plan Packs are "unlimited" behind a generous monthly soft fair-use
    cap (PLAN_PACK_FAIR_USE) that only catches runaway owner-AI cost. */
export type PlanTier = "free" | "core" | "pro";

export const PROJECT_LIMITS: Record<PlanTier, number> = { free: 1, core: 8, pro: 8 };

/**
 * Soft fair-use cap on Plan Pack generations per calendar month. Free is NOT
 * capped here (it is metered separately by build_credits). Core/Pro advertise
 * "unlimited" — these numbers sit far above any honest use and exist only to
 * stop a runaway loop from burning owner Anthropic cost. Reset monthly.
 */
export const PLAN_PACK_FAIR_USE: Record<PlanTier, number> = { free: Infinity, core: 40, pro: 120 };
export function planPackFairUseCap(plan: string | null | undefined): number {
  return PLAN_PACK_FAIR_USE[normalizePlan(plan)];
}

/** Current fair-use accounting period as 'YYYY-MM' (UTC). */
export function currentPlanPackPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Monthly AI-written career artifacts per tier. (Instant templates are unlimited & free.) */
export const ARTIFACT_LIMITS: Record<PlanTier, number> = { free: 3, core: 15, pro: Infinity };
export function artifactLimit(plan: string | null | undefined): number {
  return ARTIFACT_LIMITS[normalizePlan(plan)];
}

/**
 * Existing-repo "Plan + drift health read" allowance (lifetime, not monthly).
 * Free gets ONE — it's the lead magnet: point Pilot at any repo you own and get
 * a draft plan + an objective-standards health report, no build required. Then
 * the upgrade wall (shown BEFORE the click — no surprise, drift #8). The owner
 * AI cost is a single bounded call per read, so a low free number is enough to
 * prove value without farming. */
export const HEALTH_READ_LIMITS: Record<PlanTier, number> = { free: 1, core: 10, pro: Infinity };
export function healthReadLimit(plan: string | null | undefined): number {
  return HEALTH_READ_LIMITS[normalizePlan(plan)];
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
 * referee ships their first app) + 1 for opting in to product updates.
 */
/** Hard ceiling on provisioned projects. projectLimit() never returns more than
 *  this; the create route pre-checks it, and a BEFORE INSERT trigger
 *  (trg_enforce_project_limit, migration 009) is the atomic backstop that closes
 *  the concurrent-create race. Keep project_limit_for() in migration 009 in sync
 *  with projectLimit() below if you change the formula. */
export const PROJECT_CEILING = 8;

export function projectLimit(
  plan: string | null | undefined,
  bonusProjects: number = 0,
  profile?: { phone?: string | null; marketing_consent?: boolean | null } | null,
): number {
  // Base per tier + referral bonuses + the opt-in perk, capped at the ceiling —
  // extra slots accrue only until the total hits 8.
  const optIn = hasOptedIn(profile) ? 1 : 0;
  return Math.min(
    PROJECT_CEILING,
    PROJECT_LIMITS[normalizePlan(plan)] + Math.max(0, bonusProjects | 0) + optIn,
  );
}

/** Anyone can delete their own project. We don't paywall delete — trapping a free
 *  user with a stuck/finished project (can't delete → at their limit → can never
 *  build again) is a dead-end. The real owner cost (AI builds) is metered by
 *  build_credits, which delete doesn't refund, so delete-recreate can't farm. */
export function canDeleteProjects(_plan: string | null | undefined): boolean {
  return true;
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
