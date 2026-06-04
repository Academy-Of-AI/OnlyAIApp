import Link from "next/link";

const steps = [
  { n: "01", title: "We set up a real system", body: "A live, deployed project — database + hosting wired up for you. No blank page, no config, no setup." },
  { n: "02", title: "Build it with your agent", body: "Describe what you want. Your AI agent builds it on a reliable, database-first foundation — and we keep it on track so it doesn't wander." },
  { n: "03", title: "Own it — it runs without you", body: "A real system on your own infrastructure. The database-and-logic core keeps running even when the AI is off. Yours to keep." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav — just the logo */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-display font-bold text-lg tracking-tight text-on-surface">OnlyAIApp</span>
          <a href="https://goacademyai.com" target="_blank" rel="noopener noreferrer"
            className="hidden sm:inline text-[11px] text-outline hover:text-on-surface transition-colors whitespace-nowrap">
            by Academy of AI
          </a>
        </div>
        <Link
          href="/sign-in"
          className="btn-brand text-sm px-4 py-1.5"
        >
          Start building
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-5 sm:px-6 py-16 sm:py-24 gap-6">
        <div className="inline-flex items-center gap-2 bg-brand-container text-brand text-xs px-3 py-1 rounded-full border border-brand-border">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
          Not a prompt. Not a course.
        </div>

        {/* FIX 1: explicit space via template literal so "system built" renders correctly */}
        <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight max-w-3xl leading-[1.1] text-on-surface">
          Own a working AI system{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-fuchsia-400">
            built by you, in a day
          </span>
        </h1>

        <p className="text-on-surface-variant text-lg max-w-xl">
          Not a prompt. Not a course. A real system you build on a reliable foundation —
          one that runs without you. We handle the setup and keep your agent on track, so
          you ship something real and own it.
        </p>

        {/* FIX 4: trust anchor — ownership reassurance above the fold */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-on-surface-variant">
          <span>✓ You own the repo &amp; infra</span>
          <span>✓ Built with Claude Code</span>
          <span>✓ No API keys to manage</span>
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/sign-in" className="btn-brand font-semibold px-6 py-3">
            Start building →
          </Link>
          <Link href="/start" className="btn-ghost font-semibold px-6 py-3">
            How it works
          </Link>
        </div>

        <p className="text-xs text-outline max-w-md">
          Database + coded logic first, AI on top — so your system keeps running even when the AI is off.
        </p>
      </section>

      {/* Steps */}
      <section className="border-t border-outline-variant px-5 sm:px-6 py-14 sm:py-16">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.n} className="space-y-2">
              <span className="text-brand font-mono text-sm">{s.n}</span>
              <h3 className="font-display font-semibold text-lg text-on-surface">{s.title}</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-outline-variant px-6 py-6 text-center text-xs text-outline">
        OnlyAIApp — own a working AI system, built by you{" "}
        <span className="text-outline">·</span>{" "}
        <a href="https://goacademyai.com" target="_blank" rel="noopener noreferrer"
          className="text-outline hover:text-on-surface transition-colors">
          An Academy of AI (AOAI) product
        </a>{" "}
        <span className="text-outline">·</span>{" "}
        <Link href="/privacy" className="text-outline hover:text-on-surface transition-colors">
          Privacy
        </Link>
      </footer>
    </main>
  );
}
// Wed Jun  3 22:21:05 MPST 2026

