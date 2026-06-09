import Link from "next/link";

interface Step {
  label: string;
  done: boolean;
  href: string;
  cta: string;
  external?: boolean;
}

/**
 * Beginner onramp checklist for the Claude Code arc. Purely presentational —
 * the dashboard computes `done` from real state. Shows a graduation banner once
 * the core loop (project + plan + first build captured) is complete.
 */
export function GettingStarted({
  accountsConnected,
  hasProject,
  hasPlan,
  hasMemory,
  firstProjectId,
  isPro,
}: {
  accountsConnected: boolean;
  hasProject: boolean;
  hasPlan: boolean;
  hasMemory: boolean;
  firstProjectId: string | null;
  /** AI plan generation is Pro-gated. When explicitly false, the "Set your
   *  objective" step routes to Upgrade instead of dead-ending on a 402. Left
   *  undefined → behaves as before (assumes capable). */
  isPro?: boolean;
}) {
  const pid = firstProjectId;
  // Free users can't generate an AI plan — point them at Upgrade rather than the wall.
  const objectiveGated = isPro === false;

  // Graduation: they've run the full loop. Take the training wheels off.
  if (hasProject && hasPlan && hasMemory) {
    return (
      <section className="border border-brand-border bg-brand-container rounded-xl p-6">
        <h2 className="font-semibold text-lg font-display text-on-surface">🎓 Training wheels are off</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          You&apos;ve shipped the full loop — set an objective, built with your agent, and your
          memory is compounding. From here OnlyAIApp just keeps you on course.{" "}
          <Link href="/mission-control" className="text-brand hover:underline">Open Mission Control →</Link>
        </p>
      </section>
    );
  }

  const steps: Step[] = [
    { label: "Set up Claude Code (your engine)", done: false, href: "/start", cta: "Guide" },
    { label: "Connect GitHub", done: accountsConnected, href: "#", cta: "Connect above" },
    { label: "Create your first project", done: hasProject, href: "/new-project", cta: "New project" },
    objectiveGated
      ? { label: "Set your objective (AI plan — a Pro feature)", done: hasPlan,
          href: "/upgrade", cta: "Upgrade" }
      : { label: "Set your objective (→ a plan your agent follows)", done: hasPlan,
          href: pid ? `/projects/${pid}/plan` : "/new-project", cta: "Set objective" },
    { label: "Build it with Claude Code", done: hasMemory,
      href: pid ? `/projects/${pid}` : "/new-project", cta: "Open project" },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;

  return (
    <section className="panel p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-lg font-display text-on-surface">Your first app with an AI agent</h2>
        <span className="text-xs text-outline tabnum">{completed}/{total}</span>
      </div>
      <p className="text-sm text-on-surface-variant mb-4">
        Training wheels for Claude Code — we handle setup and keep the agent on course while you learn.
      </p>
      <div className="h-1.5 bg-surface-high rounded-full overflow-hidden mb-5">
        <div className="h-full bg-brand transition-all" style={{ width: `${(completed / total) * 100}%` }} />
      </div>

      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.label}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-outline-variant bg-surface">
            <span className={`text-base leading-none ${s.done ? "text-success" : "text-outline"}`}>
              {s.done ? "●" : "○"}
            </span>
            <span className={`flex-1 text-sm ${s.done ? "text-outline line-through" : "text-on-surface"}`}>
              {s.label}
            </span>
            {!s.done && s.href !== "#" && (
              <Link href={s.href}
                className="text-xs font-medium text-brand hover:text-brand-dim transition-colors shrink-0">
                {s.cta} →
              </Link>
            )}
          </li>
        ))}
      </ul>

      <Link href="/start" className="inline-block mt-4 text-xs text-outline hover:text-on-surface-variant transition-colors">
        New to all this? Start here →
      </Link>
    </section>
  );
}
