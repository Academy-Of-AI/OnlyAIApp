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
