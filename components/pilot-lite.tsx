"use client";

import Link from "next/link";
import { ExplainError } from "@/components/explain-error";

/**
 * <PilotLite/> — the FREE Pilot for a user's single most-recent project.
 *
 * Pilot's promise is to GUIDE, not just watch. Free users still get the part
 * that matters most on a bad day: for their latest project we show deploy
 * health, turn a broken build into one next step (<ExplainError/>), their one
 * next plan step, and a "stuck?" nudge if they've gone quiet. The full
 * multi-project board + drift + hardening stay Pro — surfaced here as an
 * upgrade nudge, not a wall.
 *
 * Server-component-safe: <ExplainError/> fetches its own route on the client,
 * so the server page only needs to pass already-loaded scalar props here.
 */
export function PilotLite({
  project,
  deploy,
  nextStep,
  stuck,
}: {
  project: { id: string; name: string };
  /** Latest deploy snapshot (already fetched server-side). */
  deploy: {
    state: "READY" | "BUILDING" | "ERROR" | "QUEUED" | "CANCELED" | "INITIALIZING" | "unknown";
    liveUrl: string | null;
    lastChangeAt: number | null;
  };
  /** The user's single next unfinished plan item (or null). */
  nextStep: string | null;
  /** True when there's been no new commit in 48h+ (the "stuck?" nudge). */
  stuck: boolean;
}) {
  const broken = deploy.state === "ERROR";
  const building = ["BUILDING", "QUEUED", "INITIALIZING"].includes(deploy.state);
  const live = deploy.state === "READY" || (!!deploy.liveUrl && !broken && !building);

  const verdict = broken
    ? { dot: "bg-danger", cls: "text-danger", label: "Needs you" }
    : building
      ? { dot: "bg-warn-dim", cls: "text-warn", label: "Building" }
      : live
        ? { dot: "bg-success", cls: "text-success", label: "Live" }
        : { dot: "bg-outline", cls: "text-on-surface-variant", label: "Not deployed yet" };

  return (
    <div className="space-y-6">
      {/* Verdict header for the single tracked project */}
      <div className="panel p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="eyebrow">Your latest project</p>
            <p className="font-display font-bold text-lg text-on-surface flex items-center gap-2 truncate">
              <span className={`dot ${verdict.dot}`} />
              {project.name}
            </p>
            <p className={`text-sm font-semibold mt-0.5 ${verdict.cls}`}>{verdict.label}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {deploy.liveUrl && (
              <a href={deploy.liveUrl} target="_blank" rel="noopener noreferrer"
                className="btn-brand text-sm font-semibold px-4 py-1.5">↗ Live app</a>
            )}
            <Link href={`/projects/${project.id}`} className="btn-ghost text-sm px-3 py-1.5">Open →</Link>
          </div>
        </div>
      </div>

      {/* Deploy health → if broken, the one next step to fix it. Free users get this. */}
      <ExplainError projectId={project.id} />

      {/* Your one next plan step */}
      {nextStep && (
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-wide text-on-surface-variant mb-1 font-medium">Your one next step on plan</p>
          <p className="text-sm text-on-surface font-medium">{nextStep}</p>
          <p className="text-[11px] text-outline mt-2">From your plan of record. Ship it, then the next one appears.</p>
        </div>
      )}

      {/* "Stuck?" nudge — quiet repo (no new commit in 48h) */}
      {stuck && (
        <div className="rounded-xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.06)] p-5">
          <p className="text-sm font-semibold text-warn">Stuck? It&apos;s been quiet for a couple of days.</p>
          <p className="text-sm text-on-surface mt-1.5">
            Momentum beats perfection. {nextStep
              ? "Paste your next step to your coding agent and let it move you forward:"
              : "Open your project and pick the next thing to ship — then paste it to your agent."}
          </p>
          {nextStep && (
            <code className="block mt-2 text-xs font-mono bg-surface border border-outline-variant rounded-lg px-3 py-2 text-brand-dim leading-relaxed">
              {nextStep}
            </code>
          )}
        </div>
      )}

      {/* Upgrade nudge — not a wall */}
      <div className="panel p-5 flex items-start justify-between gap-4 flex-wrap" style={{ boxShadow: "0 6px 24px rgba(16,24,40,.08)" }}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface flex items-center gap-1.5">🛫 Upgrade for your whole portfolio</p>
          <p className="text-sm text-on-surface-variant mt-1">
            Pilot Lite watches your latest project. Pro watches <b className="text-on-surface">every</b> app —
            health, drift from plan with the one move back on course, and launch-readiness — so nothing slips between sessions.
          </p>
        </div>
        <Link href="/upgrade" className="btn-brand text-sm font-semibold px-5 py-2.5 shrink-0">✨ Upgrade to Pro</Link>
      </div>
    </div>
  );
}
