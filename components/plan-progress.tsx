"use client";

import { useState } from "react";

type Plan = { now?: string[]; next?: string[]; later?: string[] };
type Sprint = { title: string; items: string[] };

/**
 * The spine of Pilot: progress against the plan's Now (v1) checklist, with the
 * Next/Later roadmap and the next task to hand to Claude Code. Ticking an item
 * persists to projects.plan_progress.
 */
export function PlanProgress({
  projectId, plan, sprints = [], initialDone = [],
}: {
  projectId: string;
  plan: Plan | null;
  sprints?: Sprint[];
  initialDone?: string[];
}) {
  const now = plan?.now ?? [];
  const [done, setDone] = useState<Set<string>>(new Set(initialDone));
  const [copied, setCopied] = useState(false);

  if (!plan || now.length === 0) {
    return (
      <div className="panel p-5">
        <p className="eyebrow">Progress vs your plan</p>
        <p className="text-sm text-on-surface-variant mt-2">
          No plan yet. Generate a Plan Pack in the <b>Plan</b> tab and your Now / Next / Later roadmap will track here.
        </p>
      </div>
    );
  }

  const doneCount = now.filter((i) => done.has(i)).length;
  const nextUndone = now.find((i) => !done.has(i)) ?? null;
  const nextTask = nextUndone
    ? `Build the next item from the plan: "${nextUndone}". Make it a real, working feature wired to the database (no dead buttons), then commit + push.`
    : "";

  function toggle(item: string) {
    setDone((prev) => {
      const nx = new Set(prev);
      if (nx.has(item)) nx.delete(item); else nx.add(item);
      fetch(`/api/projects/${projectId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_progress: Array.from(nx) }),
      }).catch(() => {});
      return nx;
    });
  }

  function copyNext() {
    if (!nextTask) return;
    navigator.clipboard?.writeText(nextTask);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="font-display font-bold text-[15px] text-on-surface">Progress vs your plan</p>
        <span className="text-xs text-on-surface-variant tabnum flex items-center gap-1.5">
          <span className="chip chip-brand">Now · v1</span>{doneCount} of {now.length} done{sprints.length ? ` · ${sprints.length} sprints` : ""}
        </span>
      </div>

      {/* segmented progress bar */}
      <div className="flex gap-[2px] h-2">
        {now.map((i, idx) => (
          <span key={idx} className="flex-1 rounded-full"
            style={{ background: done.has(i) ? "var(--color-success)" : i === nextUndone ? "var(--color-brand)" : "var(--color-surface-high)" }} />
        ))}
      </div>

      {/* Now checklist (tick to mark done) */}
      <div className="divide-y divide-[var(--color-outline-variant)]">
        {now.map((item) => {
          const isDone = done.has(item);
          const isNext = item === nextUndone;
          return (
            <button key={item} onClick={() => toggle(item)} className="w-full flex items-center gap-3 py-2 text-left text-sm">
              <span className={`w-[18px] h-[18px] rounded-full grid place-items-center text-[11px] shrink-0 border transition-colors ${
                isDone ? "bg-success border-success text-white" : isNext ? "border-brand text-brand" : "border-outline text-outline"}`}>
                {isDone ? "✓" : isNext ? "●" : ""}
              </span>
              <span className={isDone ? "text-on-surface-variant line-through" : "text-on-surface"}>{item}</span>
              <span className="ml-auto text-xs text-outline shrink-0">{isDone ? "done" : isNext ? "next up" : ""}</span>
            </button>
          );
        })}
      </div>

      {/* next task handoff */}
      {nextUndone ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-on-surface-variant">Next up: <b className="text-on-surface">{nextUndone}</b></span>
          <button onClick={copyNext} className="btn-ghost text-xs px-3 py-1.5">{copied ? "Copied ✓" : "Copy task for Claude Code"}</button>
        </div>
      ) : (
        <p className="text-sm text-success">✓ Everything in v1 is done — ship it, or move on to Next.</p>
      )}

      {/* Next / Later preview */}
      {((plan.next?.length ?? 0) > 0 || (plan.later?.length ?? 0) > 0) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs pt-1 border-t border-outline-variant">
          {(plan.next?.length ?? 0) > 0 && <span className="text-on-surface-variant"><b>Next:</b> {plan.next!.slice(0, 3).join(" · ")}</span>}
          {(plan.later?.length ?? 0) > 0 && <span className="text-outline"><b>Later:</b> {plan.later!.slice(0, 3).join(" · ")}</span>}
        </div>
      )}
    </div>
  );
}
