import { SubscribeButton } from "@/components/subscribe-button";
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

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-10">
      {/* X close button — back to dashboard */}
      <div className="flex justify-end">
        <Link href="/dashboard" className="text-neutral-500 hover:text-white transition-colors text-xl leading-none" aria-label="Close">✕</Link>
      </div>

      {params.upgraded && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-lg text-center">
          🎉 You&apos;re on Pro. Unlimited Plan Packs &amp; mockups + Pilot are unlocked.
        </div>
      )}

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
        <p className="text-neutral-400 max-w-xl mx-auto">
          You bring your own Claude Code — we never charge for tokens. You pay for the
          <b className="text-neutral-200"> Plan</b> (your spec) and <b className="text-neutral-200">Pilot</b> (it keeps the build on course).
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {/* Free */}
        <div className="rounded-xl p-6 space-y-5 border border-white/10">
          <div>
            <h2 className="font-bold text-lg">Free</h2>
            <p className="text-3xl font-bold mt-1">$0<span className="text-sm font-normal text-neutral-400"> forever</span></p>
            <p className="text-xs text-neutral-500 mt-1">See the magic</p>
          </div>
          <ul className="space-y-2">
            {["1 project", "1 Plan Pack (PRD · architecture · sprints)", "Quick mockups", "Hand off to Claude Code"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-neutral-300"><span className="text-green-400">✓</span>{f}</li>
            ))}
            <li className="flex gap-2 text-sm text-neutral-600"><span>—</span>No Pilot</li>
          </ul>
          {currentPlan === "free"
            ? <div className="w-full text-center text-sm text-neutral-500 py-2 border border-white/10 rounded-lg">Current plan</div>
            : <div className="w-full text-center text-sm text-neutral-500 py-2">—</div>}
        </div>

        {/* Pro */}
        <div className="rounded-xl p-6 space-y-5 border border-violet-500/50 bg-violet-500/5 relative">
          <span className="text-xs bg-violet-500 text-white font-semibold px-2 py-0.5 rounded-full">Most popular</span>
          <div>
            <h2 className="font-bold text-lg">Pro</h2>
            <p className="text-3xl font-bold mt-1">$17.97<span className="text-sm font-normal text-neutral-400">/mo</span></p>
            <p className="text-xs text-neutral-500 mt-1">or $14.97/mo billed yearly</p>
          </div>
          <ul className="space-y-2">
            {["Up to 8 projects", "Unlimited Plan Packs + mockups", "🛫 Pilot — auto-capture + drift", "Keeps every build on course"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-neutral-300"><span className="text-violet-400">✓</span>{f}</li>
            ))}
          </ul>
          {currentPlan === "pro" ? (
            <div className="w-full text-center text-sm text-neutral-500 py-2 border border-white/10 rounded-lg">Current plan</div>
          ) : (
            <div className="space-y-2">
              <SubscribeButton label="Go Pro — $17.97/mo" interval="month" />
              <SubscribeButton label="Yearly — $14.97/mo (save 17%)" interval="year" variant="outline" />
            </div>
          )}
        </div>

        {/* Build Day */}
        <div className="rounded-xl p-6 space-y-5 border border-white/10">
          <div>
            <h2 className="font-bold text-lg">Build Day</h2>
            <p className="text-3xl font-bold mt-1">$1,497</p>
            <p className="text-xs text-neutral-500 mt-1">Done with you</p>
          </div>
          <ul className="space-y-2">
            {["A live, hands-on build session", "We plan + ship your first OS together", "Everything in Pro included", "For when you want it done with you"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-neutral-300"><span className="text-neutral-500">✓</span>{f}</li>
            ))}
          </ul>
          <a href="mailto:xienpuo@onlyaiwork.com?subject=OnlyAIApp%20Build%20Day"
            className="block w-full text-center text-sm border border-white/15 hover:border-white/30 py-2 rounded-lg transition-colors">
            Book a Build Day →
          </a>
        </div>
      </div>

      <p className="text-center text-sm text-neutral-500">
        Not ready to subscribe? <BuyCreditsButton /> — no subscription, no Pilot.
      </p>
      <p className="text-center text-xs text-neutral-600 max-w-xl mx-auto">
        Cancel anytime. Your Claude Code subscription is separate — and yours. Each project gets its
        own Supabase database in <b className="text-neutral-500">your</b> account; running up to 8 needs
        Supabase Pro ($25/mo) — the free tier allows 2.
      </p>
    </main>
  );
}
