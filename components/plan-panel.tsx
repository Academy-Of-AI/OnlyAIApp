"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Milestone { id: string; title: string; detail: string | null; status: string; position: number }

const NEXT_STATUS: Record<string, string> = { todo: "in_progress", in_progress: "done", done: "todo" };
const STATUS_UI: Record<string, { box: string; cls: string }> = {
  todo: { box: "○", cls: "text-outline" },
  in_progress: { box: "◐", cls: "text-warn" },
  done: { box: "●", cls: "text-success line-through opacity-70" },
};

export function PlanPanel({
  projectId,
  hasPlan,
  objective: initialObjective,
  milestones: initialMilestones,
}: {
  projectId: string;
  hasPlan: boolean;
  objective: string | null;
  milestones: Milestone[];
}) {
  const router = useRouter();
  const [objective, setObjective] = useState("");
  const [prd, setPrd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [proGated, setProGated] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;
    setGenerating(true); setErr(null); setProGated(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective, prd }),
      });
      const data = await res.json().catch(() => ({}));
      // Pro-gated (402 / pro_required) → surface an Upgrade CTA, not bare red text.
      if (res.status === 402 || data?.code === "pro_required") { setProGated(true); return; }
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  }

  async function cycle(m: Milestone) {
    const next = NEXT_STATUS[m.status];
    setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: next } : x)));
    await fetch(`/api/projects/${projectId}/plan/milestone`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneId: m.id, status: next }),
    });
  }

  if (!hasPlan) {
    return (
      <form onSubmit={generate} className="panel p-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-on-surface">Objective</label>
          <input
            value={objective} onChange={(e) => setObjective(e.target.value)}
            placeholder="One sentence: what is this project for?"
            className="cap-input mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-on-surface">PRD / details <span className="text-outline">(optional)</span></label>
          <textarea
            value={prd} onChange={(e) => setPrd(e.target.value)} rows={5}
            placeholder="Paste your PRD, requirements, or notes. Claude breaks it into milestones."
            className="cap-input mt-1 resize-none"
          />
        </div>
        <button
          type="submit" disabled={generating || !objective.trim()}
          className="btn-brand text-sm px-4 py-2 disabled:opacity-40 transition-colors"
        >
          {generating ? "Setting milestones…" : "Set Pilot milestones"}
        </button>
        {proGated && (
          <div className="rounded-lg border border-brand-border bg-brand-container px-4 py-3 space-y-2">
            <p className="text-sm text-on-surface">
              This is <span className="font-semibold">Pilot</span> (Pro) — it turns your objective into milestones and watches your commits for drift &amp; scope creep. Your <span className="font-semibold">build plan</span> (PRD, architecture &amp; sprints) is separate and <span className="font-semibold">free</span> — generate it from the project&apos;s Plan tab.
            </p>
            <Link href="/upgrade" className="btn-brand text-sm px-4 py-2 inline-block">Upgrade to Pro →</Link>
          </div>
        )}
        {err && !proGated && <p className="text-xs text-danger">{err}</p>}
        <p className="text-xs text-on-surface-variant">
          These milestones are written into CLAUDE.md so the agent stays anchored, and Pilot flags scope creep against them.
        </p>
      </form>
    );
  }

  const done = milestones.filter((m) => m.status === "done").length;
  const pct = milestones.length ? Math.round((done / milestones.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="panel p-4">
        <p className="text-xs uppercase tracking-wide text-on-surface-variant mb-1">Objective</p>
        <p className="text-sm text-on-surface">{initialObjective}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-surface-high rounded-full overflow-hidden">
          <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-on-surface-variant tabnum">{done}/{milestones.length} done</span>
      </div>

      <div className="space-y-2">
        {milestones.map((m) => {
          const ui = STATUS_UI[m.status] ?? STATUS_UI.todo;
          return (
            <button
              key={m.id} onClick={() => cycle(m)}
              className="w-full text-left flex items-start gap-3 panel rounded-lg px-4 py-3 hover:border-outline transition"
            >
              <span className={`text-lg leading-none mt-0.5 ${ui.cls}`}>{ui.box}</span>
              <span className="flex-1">
                <span className={`text-sm font-medium ${m.status === "done" ? "line-through text-outline" : "text-on-surface"}`}>{m.title}</span>
                {m.detail && <span className="block text-xs text-on-surface-variant mt-0.5">{m.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-outline">Click a milestone to cycle todo → in&nbsp;progress → done. Each change re-syncs CLAUDE.md.</p>
    </div>
  );
}
