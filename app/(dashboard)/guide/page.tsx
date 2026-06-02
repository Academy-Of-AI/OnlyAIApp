import Link from "next/link";

export default function GuidePage() {
  const steps = [
    {
      n: "1", title: "Provision a real project",
      body: "One click creates a private GitHub repo, a Vercel project, and a Supabase database — all wired together with env vars set. You get a deployed, agent-ready scaffold in about a minute.",
      href: "/new-project", cta: "New project",
    },
    {
      n: "2", title: "Set a plan of record",
      body: "Paste your objective and PRD. Claude breaks it into ordered milestones scoped to avoid creep. This becomes your North Star — and it's written into CLAUDE.md so the agent sees it too.",
    },
    {
      n: "3", title: "Build with Claude Code / Codex",
      body: "Open the repo in your agent of choice. Because CLAUDE.md carries the objective, current milestone, decisions, and gotchas, the agent starts every session already in context.",
    },
    {
      n: "4", title: "Capture memory as you go",
      body: "Record decisions, architecture, and gotchas. They sync into CLAUDE.md so the knowledge compounds instead of evaporating between sessions.",
    },
    {
      n: "5", title: "Watch from Mission Control",
      body: "Live deploy status across every project, plain-English errors when a build breaks, env-var management, and one-click rollback. Stop opening the Vercel dashboard.",
      href: "/mission-control", cta: "Open Mission Control",
    },
    {
      n: "6", title: "Stay on course",
      body: "The course-keeper compares your commits to the plan and flags scope creep and rabbit holes before they cost you days — keeping you (and the agent) tethered to the objective.",
    },
  ];

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
      <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-white transition-colors">← Dashboard</Link>
      <h1 className="text-3xl font-bold tracking-tight mt-4 mb-2">How OnlyAIApp works</h1>
      <p className="text-neutral-400 mb-10">
        A control plane for AI-coded projects. You provision and track; Claude Code and Codex build.
        The connective tissue is <span className="font-mono text-neutral-300">CLAUDE.md</span> — the file
        your agent reads natively every session.
      </p>

      <ol className="space-y-6">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-4">
            <span className="shrink-0 w-8 h-8 rounded-full bg-violet-500/15 text-violet-300 grid place-items-center text-sm font-semibold">
              {s.n}
            </span>
            <div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-neutral-400 mt-1 leading-relaxed">{s.body}</p>
              {s.href && (
                <Link href={s.href}
                  className="inline-block mt-2 text-xs font-medium text-violet-300 hover:text-violet-200 transition-colors">
                  {s.cta} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 border-t border-white/10 pt-6">
        <p className="text-sm text-neutral-500">
          The retention engine is the memory + course-keeper loop: the longer you use a project,
          the more context accrues in CLAUDE.md and the harder it is to work without it.
        </p>
      </div>
    </main>
  );
}
