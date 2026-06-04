import Link from "next/link";

const steps = [
  {
    n: "1",
    title: "Get Claude (your engine)",
    body: "Subscribe to Claude Pro or Max. This is what actually writes your code — and it bills you directly, so OnlyAIApp never charges you for tokens. No API keys to fumble with.",
    cta: { label: "Get Claude →", href: "https://claude.ai" },
  },
  {
    n: "2",
    title: "Install Claude Code",
    body: "One command in your terminal. It's the AI coding agent that lives in your project. We'll hold your hand through it — most people are up in 5 minutes.",
    code: "npm install -g @anthropic-ai/claude-code",
  },
  {
    n: "3",
    title: "OnlyAIApp sets up a real project",
    body: "Click once. You get a live, deployed app with hosting already wired up — no git knowledge, no config files, no blank-repo panic. A real thing on the internet from minute one.",
    cta: { label: "Create your project", href: "/sign-up" },
  },
  {
    n: "4",
    title: "Point Claude Code at it",
    body: "Open the folder, type what you want. Your agent builds it. OnlyAIApp has already written a CLAUDE.md so the agent starts knowing your goal, your plan, and how to run the project.",
    code: "cd my-app && claude",
  },
  {
    n: "5",
    title: "We keep the agent on track",
    body: "Beginners let agents wander and lose the thread. OnlyAIApp's course-keeper flags when the build drifts from your goal, remembers your decisions across sessions, and shows you in plain English whether it's working.",
    cta: { label: "See Mission Control", href: "/mission-control" },
  },
];

export default function StartPage() {
  return (
    <main className="max-w-2xl mx-auto px-5 sm:px-6 py-12 sm:py-14">
      <nav className="flex items-center justify-between mb-12">
        <Link href="/" className="font-display font-bold tracking-tight text-on-surface">OnlyAIApp</Link>
        <Link href="/sign-up" className="btn-brand text-sm px-4 py-2">
          Start free
        </Link>
      </nav>

      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mb-3 leading-tight text-on-surface">Your first app with an AI agent</h1>
      <p className="text-on-surface-variant text-lg mb-2">
        Never coded before? Good. OnlyAIApp is training wheels for Claude Code — we handle the
        scary parts so you ship something real and learn the actual workflow.
      </p>
      <p className="text-sm text-outline mb-12">Five steps. About 15 minutes to your first live app.</p>

      <ol className="space-y-8">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-4">
            <span className="shrink-0 w-9 h-9 rounded-full bg-brand-container text-brand grid place-items-center text-sm font-bold">
              {s.n}
            </span>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-lg text-on-surface">{s.title}</h3>
              <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{s.body}</p>
              {s.code && (
                <code className="block mt-3 text-xs font-mono bg-surface-high border border-outline-variant rounded-lg px-3 py-2 text-brand-dim">
                  {s.code}
                </code>
              )}
              {s.cta && (
                <Link href={s.cta.href} className="inline-block mt-3 text-sm font-medium text-brand hover:text-brand-dim transition-colors">
                  {s.cta.label}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 border-t border-outline-variant pt-8">
        <h2 className="font-display font-semibold mb-2 text-on-surface">Why not just have the app build it for me?</h2>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          Because then you&apos;d learn nothing and own nothing. Tools that build it for you make a
          toy you can&apos;t change. OnlyAIApp gets <em>you</em> driving the real agent the pros use —
          with guardrails — so when the training wheels come off, you actually know how to build.
        </p>
      </div>

      <div className="mt-10 text-center">
        <Link href="/sign-up" className="inline-block btn-brand font-semibold px-6 py-3">
          Start your first app →
        </Link>
      </div>
    </main>
  );
}
