import { SubscribeButton, ManageBillingButton } from "@/components/subscribe-button";
import { BuyCreditsButton } from "@/components/buy-credits-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

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
    .from("profiles").select("plan").eq("id", user.id).single();
  const currentPlan = profile?.plan === "pro" ? "pro" : profile?.plan === "core" ? "core" : "free";
  const paid = currentPlan !== "free";

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-10">
      <div className="flex justify-end">
        <Link href="/dashboard" className="text-outline hover:text-on-surface transition-colors text-xl leading-none" aria-label="Close">✕</Link>
      </div>

      {params.upgraded && (
        <div className="bg-success/10 border border-success/30 text-success text-sm px-4 py-3 rounded-lg text-center">
          🎉 You&apos;re upgraded. Your new plan is active.
        </div>
      )}

      <div className="text-center space-y-2">
        <p className="eyebrow">Plans</p>
        <h1 className="font-display tracking-tight text-3xl font-bold text-on-surface">Simple plans. You bring your own Claude Code.</h1>
        <p className="text-on-surface-variant max-w-xl mx-auto">
          We never charge for tokens. You pay for projects and — on Pro — for <b className="text-on-surface">Pilot</b>,
          the part that keeps every build on course.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6 items-start">
        {/* Free */}
        <div className="panel p-6 space-y-5">
          <div>
            <h2 className="font-display font-bold text-lg text-on-surface">Free</h2>
            <p className="text-3xl font-bold mt-1 tabnum text-on-surface">$0<span className="text-sm font-normal text-on-surface-variant"> forever</span></p>
            <p className="text-xs text-outline mt-1">See the magic</p>
          </div>
          <ul className="space-y-2">
            {["1 project", "Plan Pack (PRD · architecture · sprints)", "Provision repo + database + hosting", "Hand off to Claude Code"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-on-surface-variant"><span className="text-success">✓</span>{f}</li>
            ))}
            <li className="flex gap-2 text-sm text-outline"><span>—</span>Can&apos;t delete · no Pilot</li>
          </ul>
          <p className="text-xs text-brand">＋ Add your WhatsApp &amp; a quick intro → unlock a 2nd free project.</p>
          {currentPlan === "free"
            ? <div className="w-full text-center text-sm text-on-surface-variant py-2 border border-outline-variant rounded-lg">Current plan</div>
            : <div className="w-full text-center text-sm text-outline py-2">—</div>}
        </div>

        {/* Core */}
        <div className="panel p-6 space-y-5">
          <div>
            <h2 className="font-display font-bold text-lg text-on-surface">Core</h2>
            <p className="text-3xl font-bold mt-1 tabnum text-on-surface">$8<span className="text-sm font-normal text-on-surface-variant">/mo</span></p>
            <p className="text-xs text-outline mt-1">Build a few real things</p>
          </div>
          <ul className="space-y-2">
            {["Up to 8 projects", "Delete & recreate freely", "Unlimited Plan Packs", "Provision + hand off"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-on-surface-variant"><span className="text-success">✓</span>{f}</li>
            ))}
            <li className="flex gap-2 text-sm text-outline"><span>—</span>No Pilot</li>
          </ul>
          {currentPlan === "core" ? (
            <div className="space-y-2">
              <div className="w-full text-center text-sm text-on-surface-variant py-2 border border-outline-variant rounded-lg">Current plan</div>
              <ManageBillingButton label="Manage subscription →" className="block w-full text-center text-sm text-brand hover:underline py-1" />
            </div>
          ) : currentPlan === "free" ? (
            <SubscribeButton label="Get Core — $8/mo" plan="core" interval="month" />
          ) : (
            <div className="w-full text-center text-sm text-outline py-2">—</div>
          )}
        </div>

        {/* Pro */}
        <div className="panel p-6 space-y-5 border-brand-border relative" style={{ background: "var(--color-brand-container)" }}>
          <span className="chip chip-brand">Most popular</span>
          <div>
            <h2 className="font-display font-bold text-lg text-on-surface">Pro</h2>
            <p className="text-3xl font-bold mt-1 tabnum text-on-surface">$17<span className="text-sm font-normal text-on-surface-variant">/mo</span></p>
            <p className="text-xs text-outline mt-1">or $11.90/mo billed yearly (−30%)</p>
          </div>
          <ul className="space-y-2">
            {["Everything in Core", "🛫 Pilot — auto-capture + drift detection", "Launch readiness checks", "Keeps every build on course"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-on-surface"><span className="text-brand">✓</span>{f}</li>
            ))}
          </ul>
          {currentPlan === "pro" ? (
            <div className="space-y-2">
              <div className="w-full text-center text-sm text-on-surface-variant py-2 border border-outline-variant rounded-lg bg-surface-low">Current plan</div>
              <ManageBillingButton label="Manage subscription →" className="block w-full text-center text-sm text-brand hover:underline py-1" />
            </div>
          ) : (
            <div className="space-y-2">
              <SubscribeButton label="Go Pro — $17/mo" plan="pro" interval="month" />
              <SubscribeButton label="Yearly — $142.80/yr (save 30%)" plan="pro" interval="year" variant="outline" />
            </div>
          )}
        </div>
      </div>

      {!paid && (
        <p className="text-center text-sm text-on-surface-variant">
          Just need more Plan Packs on Free? <BuyCreditsButton /> — no subscription.
        </p>
      )}
      <p className="text-center text-xs text-outline max-w-xl mx-auto">
        Cancel anytime. Your Claude Code subscription is separate — and yours. Each project gets its own
        Supabase database in <b className="text-on-surface-variant">your</b> account; running up to 8 needs
        Supabase Pro ($25/mo) — the free tier allows 2.
      </p>
    </main>
  );
}
