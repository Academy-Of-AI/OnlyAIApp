import Link from "next/link";

const steps = [
  { n: "01", title: "Connect GitHub", body: "Authorize once. We create repos on your behalf." },
  { n: "02", title: "Pick a template", body: "Next.js + Supabase + Stripe — production-ready from day one." },
  { n: "03", title: "Go live", body: "Vercel deploy triggered automatically. Live URL in ~60 seconds." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <span className="font-bold text-lg tracking-tight">⚡ Vibe Launchpad</span>
        <div className="flex gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-neutral-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-white text-black font-medium px-3 py-1.5 rounded-md hover:bg-neutral-200 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 gap-6">
        <div className="inline-flex items-center gap-2 bg-white/10 text-white/70 text-xs px-3 py-1 rounded-full border border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Now in beta — free for the first 200 developers
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight max-w-3xl leading-tight">
          Vibe code.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
            Ship.
          </span>{" "}
          Done.
        </h1>

        <p className="text-neutral-400 text-lg max-w-xl">
          Connect GitHub and Vercel once. Spin up a full-stack Next.js app with Supabase
          and Stripe in under 3 minutes — every time.
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
          <Link
            href="/sign-up"
            className="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Launch my first app →
          </Link>
          <a
            href="https://github.com/xp-luffy/vibe-stack-supabase"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/20 hover:border-white/40 text-white/70 hover:text-white px-6 py-3 rounded-lg transition-colors text-sm"
          >
            View template on GitHub
          </a>
        </div>
      </section>

      {/* Steps */}
      <section className="border-t border-white/10 px-6 py-16">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.n} className="space-y-2">
              <span className="text-green-400 font-mono text-sm">{s.n}</span>
              <h3 className="font-semibold text-lg">{s.title}</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-neutral-600">
        Built with ⚡ Vibe Launchpad ·{" "}
        <a href="https://github.com/xp-luffy/vibe-stack-supabase" className="hover:text-neutral-400">
          Open source template
        </a>
      </footer>
    </main>
  );
}
