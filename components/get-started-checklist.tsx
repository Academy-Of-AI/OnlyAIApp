import Link from "next/link";

type Step = { label: string; href: string; cta: string; done: boolean; external?: boolean };

/**
 * First-run guided rail on Home. Shows the 4 steps to a shipped app; the first
 * incomplete step gets the primary CTA. Hides once the user has shipped (graduated).
 */
export function GetStartedChecklist({
  hasGitHub, hasProject, hasShipped,
}: {
  hasGitHub: boolean; hasProject: boolean; hasShipped: boolean;
}) {
  const allDone = hasGitHub && hasProject && hasShipped;

  const steps: Step[] = [
    { label: "Connect GitHub", href: "/api/github/connect", cta: "Connect", done: hasGitHub, external: true },
    { label: "Pick a track & start building", href: "/tracks", cta: "Pick a track", done: hasProject },
    { label: "Ship it live", href: "/projects", cta: "Open your build", done: hasShipped },
    { label: "Show off your proof", href: "/portfolio", cta: "Open Portfolio", done: hasShipped },
  ];
  const firstTodo = steps.findIndex((s) => !s.done);

  return (
    <div className="panel p-5">
      <p className="eyebrow">{allDone ? "🎉 You're rolling" : "🚀 Get started"}</p>
      <h2 className="font-display font-semibold text-on-surface mt-1">{allDone ? "You've shipped — keep building" : "Your first 4 steps"}</h2>
      <ol className="mt-3 space-y-2.5">
        {steps.map((s, i) => {
          const isCurrent = i === firstTodo;
          return (
            <li key={s.label} className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                s.done ? "bg-success text-white" : isCurrent ? "bg-brand text-white" : "bg-surface-high text-on-surface-variant"
              }`}>
                {s.done ? "✓" : i + 1}
              </span>
              <span className={`text-sm flex-1 ${s.done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{s.label}</span>
              {isCurrent && (
                s.external
                  ? <a href={s.href} className="btn-brand text-xs px-3 py-1.5 shrink-0">{s.cta} →</a>
                  : <Link href={s.href} className="btn-brand text-xs px-3 py-1.5 shrink-0">{s.cta} →</Link>
              )}
            </li>
          );
        })}
      </ol>
      {!hasGitHub && (
        <p className="text-xs text-on-surface-variant mt-3">
          No GitHub account?{" "}
          <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer" className="text-brand-dim hover:underline">Create one free →</a>
          {" "}— takes a minute. You only need it when you build your first app.
        </p>
      )}
    </div>
  );
}
