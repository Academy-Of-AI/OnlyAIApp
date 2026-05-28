import { CreditButton } from "@/components/credit-button";
import { SubscribeButton } from "@/components/subscribe-button";
import { CREDIT_PACKS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles").select("plan, build_credits").eq("id", user.id).single();
  const currentPlan = profile?.plan ?? "free";

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-12">
      {params.upgraded && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-lg text-center">
          🎉 You&apos;re on Pro. Mission Control, plan-of-record, and the course-keeper are unlocked.
        </div>
      )}

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
        <p className="text-neutral-400">Your control plane for AI-coded projects. Start free, upgrade to run many.</p>
      </div>

      {/* Free vs Pro */}
      <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <div className="rounded-xl p-6 space-y-5 border border-white/10">
          <div>
            <h2 className="font-bold text-lg">Free</h2>
            <p className="text-3xl font-bold mt-1">$0<span className="text-sm font-normal text-neutral-400"> forever</span></p>
          </div>
          <ul className="space-y-2">
            {["1 active project", "Mission Control (live status)", "Manual CLAUDE.md sync", "Ops: env vars + rollback"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-neutral-300"><span className="text-green-400">✓</span>{f}</li>
            ))}
          </ul>
          {currentPlan === "free"
            ? <div className="w-full text-center text-sm text-neutral-500 py-2 border border-white/10 rounded-lg">Current plan</div>
            : <div className="w-full text-center text-sm text-neutral-500 py-2">—</div>}
        </div>

        <div className="rounded-xl p-6 space-y-5 border border-violet-500/50 bg-violet-500/5 relative">
          <span className="text-xs bg-violet-500 text-white font-semibold px-2 py-0.5 rounded-full">Most popular</span>
          <div>
            <h2 className="font-bold text-lg">Pro</h2>
            <p className="text-3xl font-bold mt-1">$20<span className="text-sm font-normal text-neutral-400">/month</span></p>
          </div>
          <ul className="space-y-2">
            {["Unlimited projects", "Plan-of-record + milestone tracker", "Course-keeper (drift detection)", "Auto CLAUDE.md sync", "Priority provisioning"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-neutral-300"><span className="text-violet-400">✓</span>{f}</li>
            ))}
          </ul>
          {currentPlan === "pro"
            ? <div className="w-full text-center text-sm text-neutral-500 py-2 border border-white/10 rounded-lg">Current plan</div>
            : <SubscribeButton />}
        </div>
      </div>

      {/* Deep Build credits */}
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold">Deep Build credits</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Pay-per-build for the 3-phase generator (plan → build → refine).
            {typeof profile?.build_credits === "number" && (
              <span className="text-neutral-300"> You have {profile.build_credits} credits.</span>
            )}
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {(Object.keys(CREDIT_PACKS) as Array<keyof typeof CREDIT_PACKS>).map((key) => {
            const p = CREDIT_PACKS[key];
            return (
              <div key={key} className="rounded-xl border border-white/10 p-5 space-y-3 text-center">
                <p className="text-xs uppercase tracking-wide text-neutral-500">{p.badge}</p>
                <p className="text-2xl font-bold">${(p.amountCents / 100).toFixed(0)}</p>
                <p className="text-sm text-neutral-400">{p.label}</p>
                <CreditButton pack={key} label={`Buy ${p.badge}`} />
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-neutral-600">Cancel anytime. Credits never expire.</p>
    </main>
  );
}
