import { ReferralCard } from "@/components/referral-card";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Invite & earn — OnlyAIApp" };

export default async function InvitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: refs }] = await Promise.all([
    supabase.from("profiles").select("github_username, bonus_projects").eq("id", user!.id).single(),
    supabase.from("referrals").select("status").eq("referrer_id", user!.id),
  ]);

  const list = refs ?? [];
  const invited = list.length;
  const rewarded = list.filter((r) => r.status === "rewarded").length;
  const bonus = profile?.bonus_projects ?? 0;
  const code = profile?.github_username || "you";

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <p className="eyebrow">🎁 Invite &amp; earn</p>
        <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface mt-1.5">Give a build, get a build</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Invite a friend — when they ship their first app, you <b className="text-on-surface">both</b> get a free project.
        </p>
      </div>

      <ReferralCard code={code} />

      <div className="grid grid-cols-3 gap-3">
        <div className="tile"><div className="tile-label">Friends joined</div><div className="tile-value tabnum">{invited}</div></div>
        <div className="tile"><div className="tile-label">Rewards earned</div><div className="tile-value tabnum">{rewarded}</div></div>
        <div className="tile"><div className="tile-label">Bonus projects</div><div className="tile-value tabnum">{bonus}</div></div>
      </div>

      <div className="panel p-5">
        <p className="eyebrow">How it works</p>
        <ol className="mt-3 space-y-3">
          {[
            ["Share your link", "Send your invite link to a friend (or post it anywhere)."],
            ["They join & build", "They sign up, connect GitHub, and start a build."],
            ["You both get a project", "The moment they ship their first app, you each get a free project slot."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-container text-brand-dim grid place-items-center text-xs font-bold shrink-0">{i + 1}</span>
              <div><p className="text-sm font-medium text-on-surface">{t}</p><p className="text-xs text-on-surface-variant">{d}</p></div>
            </li>
          ))}
        </ol>
      </div>

      <p className="text-xs text-outline text-center">
        Rewards are granted automatically once your friend ships — no need to claim.
      </p>
    </main>
  );
}
