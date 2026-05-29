import Link from "next/link";

const steps = [
  { n: "01", title: "Bring your Claude", body: "Use your own Claude Pro/Max subscription with Claude Code or Codex. You drive the agent — we never charge you for tokens." },
  { n: "02", title: "We set up a real project", body: "A live, deployed app + hosting, wired up for you. No git, no Vercel config, no blank-repo paralysis." },
  { n: "03", title: "We keep the agent on track", body: "Plan, memory, and a course-keeper that stops your agent wandering — so you learn the real workflow by shipping." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <span className="font-bold text-lg tracking-tight">🚀 Launchpad</span>
        <div className="flex gap-3">
          <Link href="/sign-in" className="text-sm text-neutral-400 hover:text-white transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link href="/sign-up" className="text-sm bg-white text-black font-medium px-3 py-1.5 rounded-md hover:bg-neutral-200 transition-colors">
            Start free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-5 sm:px-6 py-16 sm:py-24 gap-6">
        <div className="inline-flex items-center gap-2 bg-white/10 text-white/70 text-xs px-3 py-1 rounded-full border border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          The on-ramp to agentic coding
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight max-w-3xl leading-[1.1]">
          Build your first real app{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-300">
            with Claude Code
          </span>
        </h1>

        <p className="text-neutral-400 text-lg max-w-xl">
          Training wheels for AI coding agents. We handle the setup, the deployment, and
          keeping the agent on track — so a beginner gets from idea to a live app, and
          actually learns the real workflow instead of fighting it.
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/sign-up" className="bg-violet-500 hover:bg-violet-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
            Start your first app →
          </Link>
          <Link href="/start" className="border border-white/15 hover:border-white/30 text-neutral-200 font-semibold px-6 py-3 rounded-lg transition-colors">
            How it works
          </Link>
        </div>

        <p className="text-xs text-neutral-600 max-w-md">
          Runs on your own Claude subscription — your agent, your key. We don&apos;t mark up tokens.
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
        🚀 Launchpad — the on-ramp to agentic coding
      </footer>
    </main>
  );
}
