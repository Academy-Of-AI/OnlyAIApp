"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Milestone { id: string; title: string; detail: string | null; status: string; position: number }

const NEXT_STATUS: Record<string, string> = { todo: "in_progress", in_progress: "done", done: "todo" };
const STATUS_UI: Record<string, { box: string; cls: string }> = {
  todo: { box: "○", cls: "text-neutral-500" },
  in_progress: { box: "◐", cls: "text-amber-400" },
  done: { box: "●", cls: "text-green-400 line-through opacity-70" },
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
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;
    setGenerating(true); setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective, prd }),
      });
      const data = await res.json();
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
      <form onSubmit={generate} className="border border-white/10 rounded-xl p-5 space-y-4">
        <div>
          <label className="text-sm font-medium">Objective</label>
          <input
            value={objective} onChange={(e) => setObjective(e.target.value)}
            placeholder="One sentence: what is this project for?"
            className="w-full mt-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium">PRD / details <span className="text-neutral-600">(optional)</span></label>
          <textarea
            value={prd} onChange={(e) => setPrd(e.target.value)} rows={5}
            placeholder="Paste your PRD, requirements, or notes. Claude breaks it into milestones."
            className="w-full mt-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30 resize-none"
          />
        </div>
        <button
          type="submit" disabled={generating || !objective.trim()}
          className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
        >
          {generating ? "Generating plan…" : "Generate plan of record"}
        </button>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <p className="text-xs text-neutral-500">
          The plan is written into CLAUDE.md so the agent stays anchored to it and flags scope creep.
        </p>
      </form>
    );
  }

  const done = milestones.filter((m) => m.status === "done").length;
  const pct = milestones.length ? Math.round((done / milestones.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="border border-white/10 rounded-xl p-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Objective</p>
        <p className="text-sm text-neutral-200">{initialObjective}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-neutral-400">{done}/{milestones.length} done</span>
      </div>

      <div className="space-y-2">
        {milestones.map((m) => {
          const ui = STATUS_UI[m.status] ?? STATUS_UI.todo;
          return (
            <button
              key={m.id} onClick={() => cycle(m)}
              className="w-full text-left flex items-start gap-3 border border-white/10 rounded-lg px-4 py-3 hover:border-white/25 transition"
            >
              <span className={`text-lg leading-none mt-0.5 ${ui.cls}`}>{ui.box}</span>
              <span className="flex-1">
                <span className={`text-sm font-medium ${m.status === "done" ? "line-through text-neutral-500" : ""}`}>{m.title}</span>
                {m.detail && <span className="block text-xs text-neutral-500 mt-0.5">{m.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-neutral-600">Click a milestone to cycle todo → in&nbsp;progress → done. Each change re-syncs CLAUDE.md.</p>
    </div>
  );
}
