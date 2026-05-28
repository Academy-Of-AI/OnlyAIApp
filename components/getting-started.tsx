import Link from "next/link";

interface Step {
  label: string;
  done: boolean;
  href: string;
  cta: string;
}

/**
 * Data-driven onboarding checklist for the control-plane workflow.
 * Purely presentational — the dashboard computes `done` from real state.
 */
export function GettingStarted({
  accountsConnected,
  hasProject,
  hasPlan,
  hasMemory,
  firstProjectId,
}: {
  accountsConnected: boolean;
  hasProject: boolean;
  hasPlan: boolean;
  hasMemory: boolean;
  firstProjectId: string | null;
}) {
  const pid = firstProjectId;
  const steps: Step[] = [
    { label: "Connect GitHub, Vercel & Supabase", done: accountsConnected, href: "#", cta: "Connect above" },
    { label: "Create your first project", done: hasProject, href: "/new-project", cta: "New project" },
    { label: "Set a plan of record (objective → milestones)", done: hasPlan,
      href: pid ? `/projects/${pid}/plan` : "/new-project", cta: "Set plan" },
    { label: "Capture project memory (synced to CLAUDE.md)", done: hasMemory,
      href: pid ? `/projects/${pid}/memory` : "/new-project", cta: "Add memory" },
    { label: "Watch everything from Mission Control", done: false,
      href: "/mission-control", cta: "Open" },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  if (completed >= total - 1) return null; // hide once essentially done

  return (
    <section className="border border-white/10 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-lg">Get set up</h2>
        <span className="text-xs text-neutral-500">{completed}/{total}</span>
      </div>
      <p className="text-sm text-neutral-400 mb-4">
        Your control plane for AI-coded projects — provision, track, and keep the agent on course.
      </p>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-5">
        <div className="h-full bg-violet-500 transition-all" style={{ width: `${(completed / total) * 100}%` }} />
      </div>

      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.label}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
            <span className={`text-base leading-none ${s.done ? "text-green-400" : "text-neutral-600"}`}>
              {s.done ? "●" : "○"}
            </span>
            <span className={`flex-1 text-sm ${s.done ? "text-neutral-500 line-through" : "text-neutral-200"}`}>
              {s.label}
            </span>
            {!s.done && s.href !== "#" && (
              <Link href={s.href}
                className="text-xs font-medium text-violet-300 hover:text-violet-200 transition-colors shrink-0">
                {s.cta} →
              </Link>
            )}
          </li>
        ))}
      </ul>

      <Link href="/guide" className="inline-block mt-4 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
        How it works →
      </Link>
    </section>
  );
}
