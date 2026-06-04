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
      <div className="panel p-6 text-center text-sm text-on-surface-variant">
        Set a <span className="text-on-surface">Plan of record</span> first — drift is measured against it.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        onClick={check} disabled={loading}
        className="btn-brand text-sm px-4 py-2 transition-colors"
      >
        {loading ? "Analyzing recent work…" : "⟲ Check drift"}
      </button>
      {err && <p className="text-xs text-danger">{err}</p>}

      {report && (
        <div className="space-y-4">
          <div className={`rounded-xl p-4 border ${report.onTrack ? "border-[rgba(15,138,62,0.3)] bg-[rgba(21,164,75,0.06)]" : "border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.06)]"}`}>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${report.onTrack ? "text-success" : "text-warn"}`}>
                {report.onTrack ? "✓ On course" : "⚠ Drifting"}
              </span>
            </div>
            <p className="text-sm text-on-surface mt-2">{report.progressNote}</p>
            <p className="text-xs text-on-surface-variant mt-2">Mapped to milestone: <span className="text-on-surface">{report.currentMilestone}</span></p>
          </div>

          {report.scopeCreep?.length > 0 && (
            <div className="panel p-4">
              <p className="text-xs uppercase tracking-wide text-warn mb-3">Scope creep</p>
              <div className="space-y-2">
                {report.scopeCreep.map((s, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-on-surface">{s.item}</span>
                    <span className="block text-xs text-on-surface-variant">{s.why}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.rabbitHole?.detected && (
            <div className="panel p-4">
              <p className="text-xs uppercase tracking-wide text-danger mb-2">Rabbit hole</p>
              <p className="text-sm text-on-surface">{report.rabbitHole.area}</p>
              <p className="text-xs text-on-surface-variant mt-1">{report.rabbitHole.note}</p>
            </div>
          )}

          <div className="border-l-2 border-brand bg-brand-container rounded-r-lg px-4 py-3">
            <p className="text-xs text-brand-dim mb-1 font-medium">Course correction</p>
            <p className="text-sm text-on-surface">{report.courseCorrection}</p>
          </div>
        </div>
      )}

      <p className="text-xs text-outline">
        Compares your last ~20 commits against the plan. The objective + current milestone are also
        written into CLAUDE.md, so the agent itself is anchored — this dashboard is for you.
      </p>
    </div>
  );
}
