import Link from "next/link";
import { HOW_IT_WORKS_STEPS } from "@/lib/how-it-works";

// Deeper "while you build" detail — kept here (the guide is the fuller reference)
// but framed as supporting the 4-step journey, not a competing numbered list.
const BEHIND = [
  {
    icon: "🛟", title: "Pilot keeps watch",
    body: "See whether each app is live, get plain-English explanations when something breaks, and undo a bad change in one click — no technical dashboards to dig through.",
    href: "/pilot", cta: "Open Pilot",
  },
  {
    icon: "🧠", title: "It remembers everything",
    body: "Your decisions and lessons are saved into a CLAUDE.md notes file your AI reads every session — so it starts already up to speed instead of forgetting between sessions.",
  },
  {
    icon: "🎯", title: "It keeps you on track",
    body: "We compare what your AI builds against your plan and gently flag drift — so small detours don't quietly turn into days of lost work.",
  },
];

export default function GuidePage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
      <Link href="/dashboard" className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">← Dashboard</Link>
      <h1 className="text-3xl font-bold font-display tracking-tight text-on-surface mt-4 mb-2">How OnlyAIApp works</h1>
      <p className="text-on-surface-variant mb-10">
        Idea to a real app you own, in four steps. You pick what to build and keep watch; your AI
        agent does the building — and it all stays on track automatically.
      </p>

      {/* The 4-step journey — same source as the first-login popup, so they always match */}
      <ol className="space-y-6">
        {HOW_IT_WORKS_STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="shrink-0 w-9 h-9 rounded-xl bg-brand-container text-brand-dim grid place-items-center text-lg">{s.icon}</span>
            <div>
              <h3 className="font-semibold font-display text-on-surface">
                <span className="text-on-surface-variant font-mono text-xs mr-1.5">{i + 1}</span>{s.title}
              </h3>
              <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{s.body}</p>
              {s.href && (
                <Link href={s.href} className="inline-block mt-2 text-xs font-medium text-brand hover:text-brand-dim transition-colors">{s.cta} →</Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Behind the scenes — the deeper detail the popup doesn't have room for */}
      <div className="mt-12 border-t border-outline-variant pt-8">
        <p className="eyebrow">⚙️ While you build</p>
        <h2 className="font-display font-semibold text-xl text-on-surface mt-1 mb-5">Working for you behind the scenes</h2>
        <div className="space-y-5">
          {BEHIND.map((s) => (
            <div key={s.title} className="flex gap-4">
              <span className="shrink-0 w-9 h-9 rounded-xl bg-surface-high grid place-items-center text-lg">{s.icon}</span>
              <div>
                <h3 className="font-semibold font-display text-on-surface">{s.title}</h3>
                <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{s.body}</p>
                {s.href && (
                  <Link href={s.href} className="inline-block mt-2 text-xs font-medium text-brand hover:text-brand-dim transition-colors">{s.cta} →</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 border-t border-outline-variant pt-6">
        <p className="text-sm text-on-surface-variant">
          The longer you work on a project, the more your AI remembers — every decision and lesson
          builds up, so your assistant only gets more helpful over time.
        </p>
      </div>
    </main>
  );
}
