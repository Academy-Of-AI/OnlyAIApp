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
  error: "This is a Pro feature — it runs AI on us. Upgrade to let Launchpad keep your agent on track automatically.",
  code: "pro_required",
} as const;

/* ── Tiers ───────────────────────────────────────────────────────────────
   free  — 1 project, can't delete (anti-recycle), no Pilot. +1 project if the
           user does the data opt-in (WhatsApp + consent + short intro).
   core  — $8/mo · 8 projects · delete/recreate · no Pilot.
   pro   — $17/mo (yearly −30%) · 8 projects · advanced Pilot.            */
export type PlanTier = "free" | "core" | "pro";

export const PROJECT_LIMITS: Record<PlanTier, number> = { free: 1, core: 8, pro: 8 };

export function normalizePlan(plan: string | null | undefined): PlanTier {
  return plan === "pro" ? "pro" : plan === "core" ? "core" : "free";
}

/** The data opt-in (WhatsApp number + marketing consent) that grants the free bonus project. */
export function hasOptInBonus(
  profile: { phone?: string | null; marketing_consent?: boolean | null } | null | undefined,
): boolean {
  return !!(profile?.marketing_consent && profile?.phone && String(profile.phone).trim().length > 0);
}

/** How many projects this user may provision (free gets +1 with the opt-in). */
export function projectLimit(plan: string | null | undefined, optInBonus: boolean): number {
  const tier = normalizePlan(plan);
  return tier === "free" && optInBonus ? PROJECT_LIMITS.free + 1 : PROJECT_LIMITS[tier];
}

/** Free users can't delete their project (so they can't recycle the slot). */
export function canDeleteProjects(plan: string | null | undefined): boolean {
  return normalizePlan(plan) !== "free";
}
