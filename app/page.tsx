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
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <span className="font-bold text-lg tracking-tight">OnlyAIApp</span>
        <Link
          href="/sign-in"
          className="text-sm bg-white text-black font-medium px-4 py-1.5 rounded-md hover:bg-neutral-200 transition-colors"
        >
          Start building
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-5 sm:px-6 py-16 sm:py-24 gap-6">
        <div className="inline-flex items-center gap-2 bg-white/10 text-white/70 text-xs px-3 py-1 rounded-full border border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Not a prompt. Not a course.
        </div>

        {/* FIX 1: explicit space via template literal so "system built" renders correctly */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight max-w-3xl leading-[1.1]">
          Own a working AI system{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-300">
            built by you, in a day
          </span>
        </h1>

        <p className="text-neutral-400 text-lg max-w-xl">
          Not a prompt. Not a course. A real system you build on a reliable foundation —
          one that runs without you. We handle the setup and keep your agent on track, so
          you ship something real and own it.
        </p>

        {/* FIX 4: trust anchor — ownership reassurance above the fold */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-neutral-500">
          <span>✓ You own the repo &amp; infra</span>
          <span>✓ Built with Claude Code</span>
          <span>✓ No API keys to manage</span>
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/sign-in" className="bg-violet-500 hover:bg-violet-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
            Start building →
          </Link>
          <Link href="/start" className="border border-white/15 hover:border-white/30 text-neutral-200 font-semibold px-6 py-3 rounded-lg transition-colors">
            How it works
          </Link>
        </div>

        <p className="text-xs text-neutral-600 max-w-md">
          Database + coded logic first, AI on top — so your system keeps running even when the AI is off.
        </p>
      </section>

      {/* Steps */}
      <section className="border-t border-white/10 px-5 sm:px-6 py-14 sm:py-16">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.n} className="space-y-2">
              <span className="text-violet-400 font-mono text-sm">{s.n}</span>
              <h3 className="font-semibold text-lg">{s.title}</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-neutral-600">
        OnlyAIApp — own a working AI system, built by you
      </footer>
    </main>
  );
}
// Wed Jun  3 22:21:05 MPST 2026

