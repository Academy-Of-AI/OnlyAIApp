import { SubscribeButton } from "@/components/subscribe-button";
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
    .from("profiles").select("plan").eq("id", user.id).single();
  const currentPlan = profile?.plan ?? "free";

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      {params.upgraded && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-lg text-center">
          🎉 You&apos;re on Pro. Unlimited projects, the course-keeper, and auto memory are unlocked.
        </div>
      )}

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
        <p className="text-neutral-400">
          You bring your own Claude — we never charge you for tokens. You pay for the guidance and rails.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {/* Free */}
        <div className="rounded-xl p-6 space-y-5 border border-white/10">
          <div>
            <h2 className="font-bold text-lg">Free</h2>
            <p className="text-3xl font-bold mt-1">$0<span className="text-sm font-normal text-neutral-400"> forever</span></p>
          </div>
          <ul className="space-y-2">
            {["1 project", "Claude Code handoff + CLAUDE.md", "Mission Control (status)", "Plan of record"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-neutral-300"><span className="text-green-400">✓</span>{f}</li>
            ))}
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
            <p className="text-3xl font-bold mt-1">$12<span className="text-sm font-normal text-neutral-400">/month</span></p>
          </div>
          <ul className="space-y-2">
            {["Unlimited projects", "Course-keeper (drift detection)", "Auto memory → CLAUDE.md", "Weekly retro + notifications", "Usage & activity"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-neutral-300"><span className="text-violet-400">✓</span>{f}</li>
            ))}
          </ul>
          {currentPlan === "pro"
            ? <div className="w-full text-center text-sm text-neutral-500 py-2 border border-white/10 rounded-lg">Current plan</div>
            : <SubscribeButton />}
        </div>

        {/* Teams (coming soon) */}
        <div className="rounded-xl p-6 space-y-5 border border-white/10 opacity-80">
          <div>
            <h2 className="font-bold text-lg">Teams</h2>
            <p className="text-3xl font-bold mt-1">$10<span className="text-sm font-normal text-neutral-400">/seat/mo</span></p>
          </div>
          <ul className="space-y-2">
            {["Everything in Pro", "Shared Mission Control", "Read-only stakeholder views", "Cross-project oversight"].map((f) => (
              <li key={f} className="flex gap-2 text-sm text-neutral-300"><span className="text-neutral-500">✓</span>{f}</li>
            ))}
          </ul>
          <div className="w-full text-center text-sm text-neutral-500 py-2 border border-white/10 rounded-lg">Coming soon</div>
        </div>
      </div>

      <p className="text-center text-xs text-neutral-600">
        Cancel anytime. Your Claude subscription is separate — and yours.
      </p>
    </main>
  );
}
