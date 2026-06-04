import Link from "next/link";

export default function GuidePage() {
  const steps = [
    {
      n: "1", title: "Set up your project",
      body: "One click sets up everything your app needs — a private place to store your code, a home for your data, and live web hosting — all connected for you. In about a minute you have a working app online, ready for your AI to build on.",
      href: "/new-project", cta: "New project",
    },
    {
      n: "2", title: "Write down your plan",
      body: "Tell us what you want to build. Claude turns it into a clear, step-by-step plan you and your AI assistant both follow. We save it into a notes file your AI reads every time, so it always remembers where the project is headed.",
    },
    {
      n: "3", title: "Build with your AI assistant",
      body: "Open your project in the AI coding tool you like. Because that notes file holds your goal, the current step, and past decisions, your AI starts every session already up to speed — no need to re-explain.",
    },
    {
      n: "4", title: "Save what you learn",
      body: "As you go, jot down decisions and things to remember. We add them to the notes file so your AI keeps getting smarter about your project instead of forgetting between sessions.",
    },
    {
      n: "5", title: "Keep an eye on things from Pilot",
      body: "See whether each of your apps is live, get plain-English explanations when something breaks, manage your project's settings, and undo a bad change with one click. No need to dig through technical dashboards.",
      href: "/pilot", cta: "Open Pilot",
    },
    {
      n: "6", title: "Stay on track",
      body: "We compare what your AI is building against your plan and gently flag when it starts drifting off course — so small detours don't quietly turn into days of lost work.",
    },
  ];

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
      <Link href="/dashboard" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">← Dashboard</Link>
      <h1 className="text-3xl font-bold font-display tracking-tight text-on-surface mt-4 mb-2">How OnlyAIApp works</h1>
      <p className="text-on-surface-variant mb-10">
        The easy command-center for apps your AI builds. You set things up and keep watch; your AI
        assistant does the building. It all stays connected through <span className="mono-on">CLAUDE.md</span> —
        a notes file your AI assistant reads every time, so it always remembers your project.
      </p>

      <ol className="space-y-6">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-4">
            <span className="shrink-0 w-8 h-8 rounded-full bg-brand-container text-brand-dim grid place-items-center text-sm font-semibold">
              {s.n}
            </span>
            <div>
              <h3 className="font-semibold font-display text-on-surface">{s.title}</h3>
              <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{s.body}</p>
              {s.href && (
                <Link href={s.href}
                  className="inline-block mt-2 text-xs font-medium text-brand hover:text-brand-dim transition-colors">
                  {s.cta} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 border-t border-outline-variant pt-6">
        <p className="text-sm text-on-surface-variant">
          The longer you work on a project, the more your AI remembers — every decision and lesson
          builds up in your notes file, so your assistant only gets more helpful over time.
        </p>
      </div>
    </main>
  );
}
