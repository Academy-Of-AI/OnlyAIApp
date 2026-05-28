"use client";

import { useState } from "react";

interface DriftReport {
  onTrack: boolean;
  currentMilestone: string;
  progressNote: string;
  scopeCreep: Array<{ item: string; why: string }>;
  rabbitHole: { detected: boolean; area: string; note: string } | null;
  courseCorrection: string;
}

export function DriftPanel({ projectId, hasPlan }: { projectId: string; hasPlan: boolean }) {
  const [report, setReport] = useState<DriftReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function check() {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/drift`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setReport(data.report);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Drift check failed");
    } finally {
      setLoading(false);
    }
  }

  if (!hasPlan) {
    return (
      <div className="border border-white/10 rounded-xl p-6 text-center text-sm text-neutral-500">
        Set a <span className="text-neutral-300">Plan of record</span> first — drift is measured against it.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        onClick={check} disabled={loading}
        className="bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
      >
        {loading ? "Analyzing recent work…" : "⟲ Check drift"}
      </button>
      {err && <p className="text-xs text-red-400">{err}</p>}

      {report && (
        <div className="space-y-4">
          <div className={`rounded-xl p-4 border ${report.onTrack ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${report.onTrack ? "text-green-400" : "text-amber-400"}`}>
                {report.onTrack ? "✓ On course" : "⚠ Drifting"}
              </span>
            </div>
            <p className="text-sm text-neutral-300 mt-2">{report.progressNote}</p>
            <p className="text-xs text-neutral-500 mt-2">Mapped to milestone: <span className="text-neutral-300">{report.currentMilestone}</span></p>
          </div>

          {report.scopeCreep?.length > 0 && (
            <div className="border border-white/10 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-amber-400 mb-3">Scope creep</p>
              <div className="space-y-2">
                {report.scopeCreep.map((s, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-neutral-200">{s.item}</span>
                    <span className="block text-xs text-neutral-500">{s.why}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.rabbitHole?.detected && (
            <div className="border border-white/10 rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-red-400 mb-2">Rabbit hole</p>
              <p className="text-sm text-neutral-200">{report.rabbitHole.area}</p>
              <p className="text-xs text-neutral-500 mt-1">{report.rabbitHole.note}</p>
            </div>
          )}

          <div className="border-l-2 border-cyan-500 bg-cyan-500/5 rounded-r-lg px-4 py-3">
            <p className="text-xs text-cyan-300 mb-1 font-medium">Course correction</p>
            <p className="text-sm text-neutral-200">{report.courseCorrection}</p>
          </div>
        </div>
      )}

      <p className="text-xs text-neutral-600">
        Compares your last ~20 commits against the plan. The objective + current milestone are also
        written into CLAUDE.md, so the agent itself is anchored — this dashboard is for you.
      </p>
    </div>
  );
}
