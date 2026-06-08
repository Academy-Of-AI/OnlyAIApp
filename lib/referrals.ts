import { createAdminClient } from "@/lib/supabase/server";

/**
 * Referral growth loop. Code = the referrer's github_username (unique).
 * - attributeReferral: record who referred a new user (once; unique on referee_id).
 * - reconcileReferralReward: once the referee ships their first app, grant +1
 *   bonus project to BOTH sides. Idempotent (status flips pending → rewarded once).
 */

export async function attributeReferral(refereeId: string, code: string): Promise<void> {
  const handle = (code || "").trim();
  if (!handle) return;
  try {
    const admin = await createAdminClient();
    const { data: referrer } = await admin
      .from("profiles").select("id").eq("github_username", handle).maybeSingle();
    if (!referrer || referrer.id === refereeId) return;
    // unique(referee_id) makes this a no-op if they were already referred.
    await admin.from("referrals").insert({ referrer_id: referrer.id, referee_id: refereeId });
  } catch {
    /* attribution is best-effort — never block the auth flow */
  }
}

async function bumpBonus(admin: Awaited<ReturnType<typeof createAdminClient>>, userId: string, by = 1) {
  const { data } = await admin.from("profiles").select("bonus_projects").eq("id", userId).single();
  const current = data?.bonus_projects ?? 0;
  await admin.from("profiles").update({ bonus_projects: current + by }).eq("id", userId);
}

export async function reconcileReferralReward(refereeId: string, hasShipped: boolean): Promise<void> {
  if (!hasShipped) return;
  try {
    const admin = await createAdminClient();
    const { data: ref } = await admin
      .from("referrals").select("id, referrer_id, referee_id")
      .eq("referee_id", refereeId).eq("status", "pending").maybeSingle();
    if (!ref) return;
    // Claim the reward atomically: only the writer that flips pending → rewarded proceeds.
    const { data: claimed } = await admin
      .from("referrals")
      .update({ status: "rewarded", rewarded_at: new Date().toISOString() })
      .eq("id", ref.id).eq("status", "pending")
      .select("id").maybeSingle();
    if (!claimed) return;
    await Promise.all([bumpBonus(admin, ref.referrer_id), bumpBonus(admin, ref.referee_id)]);
  } catch {
    /* reward is best-effort — reconciled again on the next load */
  }
}
