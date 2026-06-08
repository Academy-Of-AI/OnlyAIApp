import Link from "next/link";
import { TRACKS } from "@/lib/tracks";
import { createClient } from "@/lib/supabase/server";

const steps = [
  { n: "01", icon: "🧭", title: "Pick a track", body: "Choose an outcome — land a role, a side-income tool, kill your busywork. We spin up a real, live app to start from." },
  { n: "02", icon: "🛠️", title: "Build it with AI", body: "Tell your AI agent what you want. It builds on a solid foundation — and we keep it on track so it doesn’t wander off." },
  { n: "03", icon: "🎖️", title: "Ship & show your proof", body: "Deploy a real app you own — then auto-generate a case study, a LinkedIn post, and a portfolio piece. Proof > promises." },
];

const showcase = [
  { name: "DealRoom", tag: "A tiny CRM for solo founders.", grad: "from-violet-100 to-fuchsia-100", fg: "text-violet-400" },
  { name: "FormFlow", tag: "PDF → fillable form. 12 paying users.", grad: "from-emerald-100 to-teal-100", fg: "text-emerald-400" },
  { name: "ShiftPlan", tag: "Café staff rota, used daily.", grad: "from-amber-100 to-yellow-100", fg: "text-amber-500" },
  { name: "PetCare", tag: "Vet booking, built in a weekend.", grad: "from-sky-100 to-blue-100", fg: "text-sky-400" },
];

const artifacts = [
  { icon: "📄", title: "Case study", sub: "“How I built & shipped a real app in 6 days.”" },
  { icon: "💼", title: "LinkedIn post", sub: "Ready to publish — “I just shipped a real app with AI…”" },
  { icon: "📝", title: "Résumé line", sub: "“Designed & shipped 2 production web apps, solo.”" },
  { icon: "🔗", title: "Public profile", sub: "One link with your live apps — send it to anyone." },
];

export default async function LandingPage() {
  // Auth-aware CTAs — a logged-in visitor (e.g. opening the site in a new tab)
  // shouldn't be nudged to "sign in" as if logged out.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const authed = !!user;
  const ctaHref = authed ? "/dashboard" : "/sign-in";

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-10 border-b border-outline-variant bg-[color-mix(in_srgb,var(--color-surface)_82%,transparent)] backdrop-blur">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-15 py-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-display font-bold text-lg tracking-tight text-on-surface">OnlyAIApp</span>
            <span className="hidden sm:inline text-[10px] font-bold tracking-[0.14em] uppercase text-brand">Build Studio</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-on-surface-variant">
            <a href="#how" className="hidden sm:inline hover:text-on-surface transition-colors">How it works</a>
            <a href="#showcase" className="hidden sm:inline hover:text-on-surface transition-colors">Showcase</a>
            <a href="#pricing" className="hidden sm:inline hover:text-on-surface transition-colors">Pricing</a>
            <Link href={ctaHref} className="btn-brand text-sm px-4 py-1.5">{authed ? "Open Studio →" : "Start building →"}</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden text-center px-5 sm:px-6 pt-16 sm:pt-24 pb-10">
        <div aria-hidden className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-24 h-[420px] w-[680px] max-w-[90vw] rounded-full" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-brand) 13%, transparent), transparent)" }} />
        <div className="relative max-w-3xl mx-auto flex flex-col items-center gap-5">
          <span className="inline-flex items-center gap-2 bg-brand-container text-brand-dim text-xs font-semibold px-3.5 py-1.5 rounded-full border border-brand-border">
            ✨ Not a course. A build studio.
          </span>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] text-on-surface">
            Build real AI apps.{" "}
            <span className="bg-gradient-to-r from-violet-500 to-fuchsia-400 bg-clip-text text-transparent">Walk away with proof.</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-xl">
            Learn AI by <b>doing</b> — pick an outcome, build a real app with your AI agent, and end up owning a live product <i>and</i> a portfolio you can actually show. Fun first. Proof second. Career third.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link href={ctaHref} className="btn-brand font-semibold px-6 py-3">{authed ? "Open your Studio →" : "Start building — free →"}</Link>
            <a href="#showcase" className="btn-ghost font-semibold px-6 py-3">See what people shipped</a>
          </div>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-on-surface-variant mt-1">
            <span>✓ You own the code &amp; hosting</span>
            <span>✓ Bring your own AI agent</span>
            <span>✓ No setup, no config</span>
          </div>
        </div>
      </header>

      {/* How it works */}
      <section id="how" className="border-t border-outline-variant px-5 sm:px-6 py-14 sm:py-16 scroll-mt-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-on-surface text-center">From idea to proof in 3 steps 🚀</h2>
          <p className="text-on-surface-variant text-center mt-2 max-w-lg mx-auto">No blank page. No tutorials to grind. Just pick a thing to build and go.</p>
          <div className="grid sm:grid-cols-3 gap-4 mt-10">
            {steps.map((s) => (
              <div key={s.n} className="panel p-5">
                <span className="text-brand font-mono text-sm font-bold">{s.n}</span>
                <div className="text-2xl mt-1.5">{s.icon}</div>
                <h3 className="font-display font-semibold text-lg text-on-surface mt-2">{s.title}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed mt-1">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section className="border-t border-outline-variant px-5 sm:px-6 py-14 sm:py-16 bg-surface-dim">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-on-surface text-center">Pick your outcome 🎯</h2>
          <p className="text-on-surface-variant text-center mt-2 max-w-lg mx-auto">Every track ends with a real, deployed thing you own — never a certificate.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
            {TRACKS.map((t) => (
              <div key={t.key} className="panel p-5 flex flex-col gap-1.5">
                <div className="text-2xl">{t.icon}</div>
                <h3 className="font-display font-semibold text-on-surface">{t.title}</h3>
                <div className="text-xs text-on-surface-variant bg-surface border border-outline-variant rounded-lg px-2.5 py-2 mt-1">You’ll ship: <b className="text-on-surface">{t.ship}</b></div>
                <div className="flex gap-3 text-xs text-on-surface-variant mt-1">
                  <span>⏱ <b className="text-on-surface">{t.time}</b></span>
                  <span>📈 <b className="text-on-surface">{t.difficulty}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section id="showcase" className="border-t border-outline-variant px-5 sm:px-6 py-14 sm:py-16 scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-on-surface text-center">Real apps. Really shipped. ✨</h2>
          <p className="text-on-surface-variant text-center mt-2 max-w-lg mx-auto">Every one is live and owned by the person who built it. This could be yours next week.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {showcase.map((a) => (
              <div key={a.name} className="panel overflow-hidden flex flex-col">
                <div className={`h-28 grid place-items-center font-bold bg-gradient-to-br ${a.grad} ${a.fg} border-b border-outline-variant`}>{a.name}</div>
                <div className="p-4">
                  <span className="chip chip-success">Live</span>
                  <p className="font-display font-semibold text-on-surface mt-1.5">{a.name}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">{a.tag}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/sign-in" className="btn-ghost font-semibold px-5 py-2.5">Browse the full Showcase →</Link>
          </div>
        </div>
      </section>

      {/* Career payoff */}
      <section className="border-t border-outline-variant px-5 sm:px-6 py-14 sm:py-16 bg-surface-dim">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-on-surface text-center">You don’t get a certificate. You get proof. 🎖️</h2>
          <p className="text-on-surface-variant text-center mt-2 max-w-xl mx-auto">Everything you build becomes career leverage — automatically generated from what you actually shipped.</p>
          <div className="grid md:grid-cols-2 gap-4 mt-10 items-start">
            <div className="space-y-2.5">
              {artifacts.map((a) => (
                <div key={a.title} className="panel p-4 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg grid place-items-center bg-brand-container text-lg shrink-0">{a.icon}</span>
                  <div className="min-w-0"><p className="text-sm font-medium text-on-surface">{a.title}</p><p className="text-xs text-on-surface-variant">{a.sub}</p></div>
                </div>
              ))}
            </div>
            <div className="panel p-6">
              <p className="eyebrow">The real rule</p>
              <h3 className="font-display font-semibold text-xl text-on-surface mt-2">Fun → Proof → Career</h3>
              <p className="text-on-surface-variant text-sm mt-1.5">Most “learn AI” products leave you with notes and a vibe. You leave with <b className="text-on-surface">live apps, a portfolio, and confidence</b> — the stuff that actually moves your career.</p>
              <Link href="/sign-in" className="btn-brand font-semibold px-5 py-2.5 mt-4 inline-flex">Build your proof →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Referral */}
      <section className="border-t border-outline-variant px-5 sm:px-6 py-14 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl p-7 sm:p-8 flex items-center justify-between gap-5 flex-wrap" style={{ background: "linear-gradient(110deg,#1b1230,#2a1750)", color: "#fff" }}>
            <div className="min-w-0">
              <h3 className="font-display font-bold text-2xl">🎁 Build with a friend — give a build, get a build</h3>
              <p className="text-sm mt-1.5 max-w-[46ch]" style={{ color: "#cdbdf0" }}>Invite a friend. When they ship their first app, you <b className="text-white">both</b> get a free project. The more you share, the more you build.</p>
            </div>
            <Link href="/sign-in" className="rounded-lg px-5 py-3 font-semibold text-sm shrink-0" style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.25)", color: "#fff" }}>Get your invite link →</Link>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-outline-variant px-5 sm:px-6 py-14 sm:py-16 bg-surface-dim scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-on-surface text-center">Simple pricing 💸</h2>
          <p className="text-on-surface-variant text-center mt-2 max-w-lg mx-auto">Bring your own AI agent — Claude Code, Codex, or any. We never mark up what you pay for AI.</p>
          <div className="grid sm:grid-cols-3 gap-4 mt-10 items-stretch">
            <Tier name="Free" price="$0" cta="Start free" feats={["Ship 1 real app", "Full Portfolio + career artifacts", "Public profile + Showcase", "Progress + next-step"]} />
            <Tier name="Core" price="$8" per="/mo" cta="Choose Core" feats={["Up to 8 projects", "Delete & recreate freely", "Everything in Free"]} note="or save 25% billed yearly" />
            <Tier name="Pro" price="$17" per="/mo" pop cta="Go Pro" feats={["Everything in Core", "Accept payments (Stripe)", "Production hardening (monitoring & analytics)", "Advanced build tracking"]} note="or save 30% billed yearly" badge="Power up" />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-outline-variant px-5 sm:px-6 py-16 text-center">
        <h2 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-on-surface">Your first real app is one click away.</h2>
        <p className="text-on-surface-variant text-base mt-2">Pick a track. Build it. Show it off. Let’s go. 🚀</p>
        <Link href={ctaHref} className="btn-brand font-semibold px-6 py-3 mt-6 inline-flex">{authed ? "Open your Studio →" : "Start building — free →"}</Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-outline-variant px-6 py-6 text-center text-xs text-outline">
        OnlyAIApp — build real AI apps, walk away with proof{" "}
        <span className="text-outline">·</span>{" "}
        <a href="https://www.linkedin.com/in/ngxienpuo/" target="_blank" rel="noopener noreferrer" className="text-outline hover:text-on-surface transition-colors">Made by Ng Xien Puo</a>{" "}
        <span className="text-outline">·</span>{" "}
        <Link href="/privacy" className="text-outline hover:text-on-surface transition-colors">Privacy</Link>
      </footer>
    </main>
  );
}

function Tier({ name, price, per, feats, note, pop, badge, cta }: {
  name: string; price: string; per?: string; feats: string[]; note?: string; pop?: boolean; badge?: string; cta?: string;
}) {
  return (
    <div className={`panel p-6 relative flex flex-col gap-2 ${pop ? "border-brand-border shadow-[0_6px_24px_rgba(124,58,237,0.14)]" : ""}`}>
      {badge && <span className="absolute -top-2.5 left-6 bg-brand text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">{badge}</span>}
      <p className="font-display font-bold text-lg text-on-surface">{name}</p>
      <p className="font-display font-extrabold text-3xl tracking-tight text-on-surface">{price}{per && <span className="text-sm font-semibold text-on-surface-variant">{per}</span>}</p>
      <ul className="space-y-1.5 mt-1 flex-1">
        {feats.map((f) => (
          <li key={f} className="text-sm text-on-surface-variant flex gap-2"><span className="text-success font-bold">✓</span>{f}</li>
        ))}
      </ul>
      {note && <p className="text-xs text-on-surface-variant mt-1">{note}</p>}
      <Link href="/sign-in" className={`${pop ? "btn-brand" : "btn-ghost"} text-sm font-semibold px-4 py-2.5 text-center mt-3`}>{cta ?? "Get started"} →</Link>
    </div>
  );
}
