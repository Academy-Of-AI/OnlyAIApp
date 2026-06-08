import { SubscribeButton, ManageBillingButton } from "@/components/subscribe-button";
import { Invoices } from "@/components/invoices";
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
  const plan = profile?.plan === "pro" ? "pro" : profile?.plan === "core" ? "core" : "free";

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
      <div className="flex justify-end">
        <Link href="/dashboard" className="text-outline hover:text-on-surface transition-colors text-xl leading-none" aria-label="Close">✕</Link>
      </div>

      {params.upgraded && (
        <div className="bg-success/10 border border-success/30 text-success text-sm px-4 py-3 rounded-lg text-center max-w-md mx-auto">
          🎉 You&apos;re upgraded — your new plan is active.
        </div>
      )}

      <header className="text-center space-y-3 max-w-2xl mx-auto">
        <p className="eyebrow">Plans</p>
        <h1 className="font-display tracking-tight text-3xl sm:text-4xl font-bold text-on-surface">
          Pay for outcomes, not tokens
        </h1>
        <p className="text-on-surface-variant text-lg leading-relaxed">
          Bring your own AI agent — Claude Code, Codex, whatever you use; we never mark up AI.
          Start free with your full Portfolio &amp; proof, grow into Core to build more, and go
          <b className="text-on-surface"> Pro</b> to ship a real product — payments, custom domains &amp; more.
        </p>
      </header>

      <div className="grid sm:grid-cols-3 gap-5 items-stretch">
        {/* Free */}
        <Tier
          name="Free"
          price="$0"
          period="forever"
          tagline="See it work, end to end."
          features={[
            "1 live project",
            "Repo, database & hosting set up for you",
            "🎖️ Full Portfolio + career artifacts (3 AI writes/mo)",
            "Hand off to your AI agent (Claude Code, Codex…)",
          ]}
          current={plan === "free"}
          cta={<Link href="/tracks" className="block w-full text-center text-sm font-semibold rounded-lg py-2.5 border border-outline-variant text-on-surface hover:border-outline transition-colors">Start building →</Link>}
        />

        {/* Core */}
        <Tier
          name="Core"
          price="$8"
          period="/month"
          tagline="For building in earnest."
          sub="or $6/mo billed yearly — save 25%"
          features={[
            "Everything in Free",
            "Up to 8 live projects",
            "Delete & recreate anytime",
            "✍️ 15 AI artifact writes / month",
            "Unlimited re-plans — regenerate a fresh build plan for any project, anytime (separate from the 8-project limit)",
          ]}
          current={plan === "core"}
          cta={
            plan === "free" ? (
              <div className="space-y-2">
                <SubscribeButton label="Choose Core — $8/mo" plan="core" interval="month" />
                <SubscribeButton label="Yearly — save 25%" plan="core" interval="year" variant="outline" />
              </div>
            )
            : plan === "core" ? <ManageBillingButton label="Manage subscription →" className="block w-full text-center text-sm text-brand hover:underline py-2" />
            : <p className="text-center text-xs text-on-surface-variant py-2">Included in Pro</p>
          }
        />

        {/* Pro */}
        <Tier
          name="Pro"
          price="$17"
          period="/month"
          tagline="Ship a real, monetizable product."
          highlight
          badge="Ship for real"
          sub="or $11.90/mo billed yearly — save 30%"
          features={[
            "Everything in Core",
            "✍️ Unlimited AI career artifacts",
            "💳 Accept payments in your apps (Stripe)",
            "🌐 Custom domains for your apps",
            "🔌 Add-ons: Sentry, PostHog & Upstash (your keys)",
            "🛫 Advanced build tracking (drift & auto-capture)",
          ]}
          current={plan === "pro"}
          cta={
            plan === "pro"
              ? <ManageBillingButton label="Manage subscription →" className="block w-full text-center text-sm text-brand hover:underline py-2" />
              : (
                <div className="space-y-2">
                  <SubscribeButton label="Go Pro — $17/mo" plan="pro" interval="month" />
                  <SubscribeButton label="Yearly — save 30%" plan="pro" interval="year" variant="outline" />
                </div>
              )
          }
        />
      </div>

      <p className="text-center text-sm text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
        Cancel anytime. Your AI agent subscription (Claude Code, Codex, etc.) is separate — and yours.
        Each project runs on its own database in your own cloud account, so your data and infrastructure stay fully yours.
        <br />
        <span className="font-medium text-on-surface">Heads up:</span> running multiple live projects (Core &amp; Pro)
        needs a <b className="text-on-surface">Supabase Pro plan</b> — each project provisions its own database, billed by Supabase, separate from this.
      </p>

      {plan !== "free" && (
        <section className="max-w-2xl mx-auto w-full space-y-3">
          <h2 className="font-display font-semibold text-on-surface">Invoices &amp; receipts</h2>
          <Invoices />
        </section>
      )}
    </main>
  );
}

function Tier({
  name, price, period, tagline, features, current, highlight = false, badge, sub, cta, footer,
}: {
  name: string;
  price: string;
  period: string;
  tagline: string;
  features: string[];
  current: boolean;
  highlight?: boolean;
  badge?: string;
  sub?: string;
  cta?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className={`panel p-6 flex flex-col ${highlight ? "border-brand-border ring-1 ring-[var(--color-brand-border)]" : ""}`}
      style={highlight ? { background: "var(--color-brand-container)" } : undefined}
    >
      {badge ? <span className="chip chip-brand self-start mb-3">{badge}</span> : null}
      <div>
        <h2 className="font-display font-bold text-lg text-on-surface">{name}</h2>
        <p className="mt-1">
          <span className="text-3xl font-bold tabnum text-on-surface">{price}</span>
          <span className="text-sm font-normal text-on-surface-variant"> {period}</span>
        </p>
        <p className="text-sm text-on-surface-variant mt-1.5">{tagline}</p>
        {sub ? <p className="text-xs text-outline mt-1">{sub}</p> : null}
      </div>

      <ul className="space-y-2.5 my-6 flex-1">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5 text-sm text-on-surface">
            <span className={highlight ? "text-brand" : "text-success"} aria-hidden>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-2">
        {current ? (
          <div className="w-full text-center text-sm text-on-surface-variant py-2 border border-outline-variant rounded-lg bg-surface-low">
            Current plan
          </div>
        ) : null}
        {!current && cta ? cta : null}
        {footer}
      </div>
    </div>
  );
}
