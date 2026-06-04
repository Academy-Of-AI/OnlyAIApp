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
  const currentPlan = profile?.plan ?? "free";
  const isPro = currentPlan === "pro";

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-10">
      <div className="flex justify-end">
        <Link href="/dashboard" className="text-outline hover:text-on-surface transition-colors text-xl leading-none" aria-label="Close">✕</Link>
      </div>

      {params.upgraded && (
        <div className="bg-success/10 border border-success/30 text-success text-sm px-4 py-3 rounded-lg text-center">
          🎉 You&apos;re on Pro. Pilot — auto-capture, drift, and launch readiness — is unlocked.
        </div>
      )}

      <div className="text-center space-y-2">
        <p className="eyebrow">Plans</p>
        <h1 className="font-display tracking-tight text-3xl font-bold text-on-surface">Free to plan &amp; ship. Pro to keep it on course.</h1>
        <p className="text-on-surface-variant max-w-xl mx-auto">
          You bring your own Claude Code — we never charge for tokens. Free gets you from idea to a
          handed-off build. <b className="text-on-surface">Pilot</b> (the part that keeps the build on
          track) is Pro.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {/* Free */}
        <div className="panel p-6 space-y-5">
          <div>
            <h2 className="font-display font-bold text-lg text-on-surface">Free</h2>
            <p className="text-3xl font-bold mt-1 tabnum text-on-surface">$0<span className="text-sm font-normal text-on-surface-variant"> forever</span></p>
            <p className="text-xs text-outline mt-1">See the magic</p>
          </div>
          <ul className="space-y-2">
            {["1 project", "1 Plan Pack (PRD · architecture · sprints)", "Provision repo + database + hosting", "Hand off to Claude Code"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-on-surface-variant"><span className="text-success">✓</span>{f}</li>
            ))}
            <li className="flex gap-2 text-sm text-outline"><span>—</span>No Pilot</li>
          </ul>
          {currentPlan === "free"
            ? <div className="w-full text-center text-sm text-on-surface-variant py-2 border border-outline-variant rounded-lg">Current plan</div>
            : <div className="w-full text-center text-sm text-outline py-2">—</div>}
        </div>

        {/* Pro */}
        <div className="panel p-6 space-y-5 border-brand-border relative" style={{ background: "var(--color-brand-container)" }}>
          <span className="chip chip-brand">Most popular</span>
          <div>
            <h2 className="font-display font-bold text-lg text-on-surface">Pro</h2>
            <p className="text-3xl font-bold mt-1 tabnum text-on-surface">$17.97<span className="text-sm font-normal text-on-surface-variant">/mo</span></p>
            <p className="text-xs text-outline mt-1">or $14.97/mo billed yearly</p>
          </div>
          <ul className="space-y-2">
            {["Up to 8 projects", "Unlimited Plan Packs", "🛫 Pilot — auto-capture + drift detection", "Launch readiness + keeps every build on course"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-on-surface"><span className="text-brand">✓</span>{f}</li>
            ))}
          </ul>
          {isPro ? (
            <div className="space-y-2">
              <div className="w-full text-center text-sm text-on-surface-variant py-2 border border-outline-variant rounded-lg bg-surface-low">Current plan</div>
              <ManageBillingButton label="Manage subscription →" className="block w-full text-center text-sm text-brand hover:underline py-1" />
            </div>
          ) : (
            <div className="space-y-2">
              <SubscribeButton label="Go Pro — $17.97/mo" interval="month" />
              <SubscribeButton label="Yearly — $14.97/mo (save 17%)" interval="year" variant="outline" />
            </div>
          )}
        </div>

        {/* Build Day */}
        <div className="panel p-6 space-y-5">
          <div>
            <h2 className="font-display font-bold text-lg text-on-surface">Build Day</h2>
            <p className="text-3xl font-bold mt-1 tabnum text-on-surface">$1,497</p>
            <p className="text-xs text-outline mt-1">Done with you</p>
          </div>
          <ul className="space-y-2">
            {["A live, hands-on build session", "We plan + ship your first OS together", "Everything in Pro included", "For when you want it done with you"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-on-surface-variant"><span className="text-on-surface-variant">✓</span>{f}</li>
            ))}
          </ul>
          <a href="mailto:xienpuo@onlyaiwork.com?subject=OnlyAIApp%20Build%20Day"
            className="btn-ghost block w-full text-center text-sm py-2">
            Book a Build Day →
          </a>
        </div>
      </div>

      {!isPro && (
        <p className="text-center text-sm text-on-surface-variant">
          Not ready to subscribe? <BuyCreditsButton /> — extra Plan Packs, no subscription, no Pilot.
        </p>
      )}
      <p className="text-center text-xs text-outline max-w-xl mx-auto">
        Cancel anytime. Your Claude Code subscription is separate — and yours. Each project gets its
        own Supabase database in <b className="text-on-surface-variant">your</b> account; running up to 8 needs
        Supabase Pro ($25/mo) — the free tier allows 2.
      </p>
    </main>
  );
}
