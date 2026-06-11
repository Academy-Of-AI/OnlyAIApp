"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/date";

/* ── Shared shapes (mirror lib/pilot/repo-audit.ts) ────────────────────────── */
type Severity = "high" | "medium" | "low";
interface Finding {
  ruleId: string; drift: string; severity: Severity;
  title: string; fix: string; file: string; line: number; evidence: string;
}
interface Milestone { title: string; detail: string }
interface Report {
  id?: string | null;
  repoFullName: string;
  score: number;
  grade: string;
  summary: string;
  stack: string[];
  findings: Finding[];
  draftPlan: { objective: string; milestones: Milestone[]; source: string };
  aiUsed: boolean;
  notes: string[];
  createdAt?: string | null;
}
interface RepoOption { fullName: string; private: boolean; language: string | null; description: string | null }

/** Stored rows come back snake_cased — normalise to the camelCase Report shape. */
type StoredRow = {
  id: string; repo_full_name: string; score: number; grade: string; summary: string;
  stack: string[]; draft_plan: Report["draftPlan"]; findings: Finding[]; ai_used: boolean;
  notes: string[]; created_at: string;
};
function fromRow(r: StoredRow): Report {
  return {
    id: r.id, repoFullName: r.repo_full_name, score: r.score, grade: r.grade, summary: r.summary,
    stack: r.stack ?? [], findings: r.findings ?? [], draftPlan: r.draft_plan, aiUsed: r.ai_used,
    notes: r.notes ?? [], createdAt: r.created_at,
  };
}

const SEV: Record<Severity, { label: string; cls: string; dot: string }> = {
  high: { label: "High", cls: "text-danger", dot: "bg-danger" },
  medium: { label: "Medium", cls: "text-warn", dot: "bg-warn" },
  low: { label: "Low", cls: "text-on-surface-variant", dot: "bg-outline" },
};
const GRADE_CLR: Record<string, string> = { A: "var(--color-success)", B: "var(--color-success)", C: "var(--color-warn)", D: "var(--color-danger)" };

export function RepoHealth({
  githubConnected, used, limit, plan, initialReads,
}: {
  githubConnected: boolean;
  used: number;
  limit: number | null; // null = unlimited
  plan: string;
  initialReads: StoredRow[];
}) {
  const [reads, setReads] = useState<Report[]>((initialReads ?? []).map(fromRow));
  const [usedN, setUsedN] = useState(used);
  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [picked, setPicked] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading-repos" | "running" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState<Report | null>((initialReads ?? []).length ? fromRow(initialReads[0]) : null);

  const atWall = limit !== null && usedN >= limit;
  const left = limit === null ? null : Math.max(0, limit - usedN);

  async function loadRepos() {
    if (repos || phase === "loading-repos") return;
    setPhase("loading-repos"); setErr(null);
    try {
      const res = await fetch("/api/repo-health/repos");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? "Couldn't list your repos."); setPhase("error"); return; }
      setRepos(data.repos ?? []);
      setPhase("idle");
    } catch { setErr("Couldn't reach the server — try again."); setPhase("error"); }
  }

  async function run() {
    if (!picked || atWall) return;
    setPhase("running"); setErr(null);
    try {
      const res = await fetch("/api/repo-health", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ repoFullName: picked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(data.error ?? "The health read failed — try again."); setPhase("error"); return; }
      const report: Report = data.report;
      setActive(report);
      setReads((prev) => [report, ...prev]);
      if (typeof data.used === "number") setUsedN(data.used);
      setPhase("idle");
    } catch { setErr("Couldn't reach the server — try again in a moment."); setPhase("error"); }
  }

  /* ── GitHub not connected — the only hard gate ───────────────────────────── */
  if (!githubConnected) {
    return (
      <div className="panel p-6 text-center space-y-3">
        <p className="text-3xl">🔗</p>
        <p className="text-sm font-medium text-on-surface">Connect GitHub to read an existing repo</p>
        <p className="text-xs text-on-surface-variant max-w-md mx-auto">
          The health read needs read access to list and open your repos. We only ever read — we never push or change your code.
        </p>
        <a href="/api/github/connect" className="btn-brand inline-flex text-sm px-4 py-2 mt-1">Connect GitHub</a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Picker + allowance (shown BEFORE the wall — no surprise) */}
      <div className="panel p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-on-surface">Pick a repo to read</p>
          <span className="text-xs text-on-surface-variant">
            {limit === null
              ? "Unlimited reads on your plan"
              : <>{left} of {limit} free read{limit === 1 ? "" : "s"} left</>}
          </span>
        </div>

        {atWall ? (
          <div className="rounded-lg p-3 text-sm" style={{ background: "color-mix(in srgb, var(--color-brand) 12%, transparent)" }}>
            <p className="text-on-surface">You’ve used your free repo health read.</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Upgrade to read more repos and unlock the full Pilot.</p>
            <Link href="/upgrade" className="btn-brand inline-flex text-xs px-3 py-1.5 mt-2">✨ Upgrade</Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={picked}
              onFocus={loadRepos}
              onChange={(e) => setPicked(e.target.value)}
              className="flex-1 min-w-[220px] rounded-lg bg-surface-high border border-[var(--color-outline-variant)] px-3 py-2 text-sm text-on-surface"
            >
              <option value="">
                {phase === "loading-repos" ? "Loading your repos…" : repos ? "Select a repo…" : "Click to load your repos…"}
              </option>
              {(repos ?? []).map((r) => (
                <option key={r.fullName} value={r.fullName}>
                  {r.fullName}{r.private ? " (private)" : ""}{r.language ? ` · ${r.language}` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={run}
              disabled={!picked || phase === "running"}
              className="btn-brand text-sm font-semibold px-4 py-2 shrink-0 disabled:opacity-60"
            >
              {phase === "running" ? "Reading…" : "Read repo →"}
            </button>
          </div>
        )}
        {err && <p className="text-xs text-danger">{err}</p>}
        {phase === "running" && (
          <p className="text-xs text-on-surface-variant">Reading the code, auditing against standards, drafting the plan… (~20–40s)</p>
        )}
      </div>

      {/* The report */}
      {active ? <ReportView report={active} /> : (
        <div className="panel p-8 text-center text-on-surface-variant text-sm">
          <p className="text-3xl mb-2">🩺</p>
          Pick a repo above and we’ll read it — a draft plan and a health check appear here.
        </div>
      )}

      {/* History */}
      {reads.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Past reads</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {reads.map((r, i) => (
              <button
                key={r.id ?? i}
                onClick={() => setActive(r)}
                className={`panel p-3 text-left hover:bg-surface-high transition-colors ${active === r ? "border-l-[3px] border-l-brand" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-on-surface truncate">{r.repoFullName}</span>
                  <span className="text-xs font-bold tabnum shrink-0" style={{ color: GRADE_CLR[r.grade] ?? "var(--color-on-surface)" }}>{r.grade} · {r.score}</span>
                </div>
                <p className="text-[11px] text-outline mt-0.5">{r.createdAt ? formatDate(r.createdAt) : ""} · {r.findings.length} finding{r.findings.length === 1 ? "" : "s"}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  const grouped: Record<Severity, Finding[]> = { high: [], medium: [], low: [] };
  for (const f of report.findings) grouped[f.severity].push(f);

  return (
    <div className="space-y-5">
      {/* Score header */}
      <div className="panel p-5 flex items-start gap-5 flex-wrap">
        <div className="text-center shrink-0">
          <div className="text-4xl font-bold font-display" style={{ color: GRADE_CLR[report.grade] ?? "var(--color-on-surface)" }}>{report.grade}</div>
          <div className="text-xs text-on-surface-variant mt-0.5 tabnum">{report.score}/100</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-display font-semibold text-on-surface truncate">{report.repoFullName}</p>
            {report.stack.map((s) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-high text-on-surface-variant">{s}</span>
            ))}
          </div>
          <p className="text-sm text-on-surface-variant mt-1.5">{report.summary}</p>
        </div>
      </div>

      {/* Draft plan — honestly labelled */}
      <div className="panel p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold text-on-surface">📋 Draft plan</p>
          <span className="text-[11px] text-outline">
            {report.draftPlan.source === "ai" ? "reverse-engineered from your code — review & edit" : "structural draft — review & edit"}
          </span>
        </div>
        <p className="text-sm text-on-surface"><span className="text-on-surface-variant">Objective: </span>{report.draftPlan.objective}</p>
        <ol className="space-y-1.5">
          {report.draftPlan.milestones.map((m, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="text-brand-dim font-semibold tabnum shrink-0">{i + 1}.</span>
              <span><span className="text-on-surface font-medium">{m.title}</span><span className="text-on-surface-variant"> — {m.detail}</span></span>
            </li>
          ))}
        </ol>
      </div>

      {/* Findings */}
      <div className="panel p-5 space-y-3">
        <p className="text-sm font-semibold text-on-surface">
          🔍 Health check — {report.findings.length} issue{report.findings.length === 1 ? "" : "s"} vs objective standards
        </p>
        {report.findings.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            None of the objective checks we run fired on the files we scanned. That’s a good sign — but it’s a budgeted slice, not a proof of correctness. Verify the live journey end-to-end yourself.
          </p>
        ) : (
          (["high", "medium", "low"] as Severity[]).filter((s) => grouped[s].length).map((sev) => (
            <div key={sev} className="space-y-2">
              <p className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${SEV[sev].cls}`}>
                <span className={`dot ${SEV[sev].dot}`} />{SEV[sev].label} · {grouped[sev].length}
              </p>
              {grouped[sev].map((f, i) => (
                <div key={i} className="rounded-lg border border-[var(--color-outline-variant)] p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium text-on-surface">{f.title}</p>
                    <span className="text-[10px] text-outline shrink-0">{f.drift}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant"><span className="text-outline">where: </span><code className="text-brand-dim">{f.file}:{f.line}</code></p>
                  <p className="text-xs text-on-surface-variant">{f.fix}</p>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Honest caveats */}
      {report.notes.length > 0 && (
        <div className="panel p-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Good to know</p>
          <ul className="space-y-1">
            {report.notes.map((n, i) => (
              <li key={i} className="text-xs text-on-surface-variant flex gap-2"><span className="text-outline shrink-0">·</span>{n}</li>
            ))}
          </ul>
          {!report.aiUsed && (
            <p className="text-[11px] text-outline pt-1">The objective checks above don’t need AI — they’re exact. The plan is a structural draft.</p>
          )}
        </div>
      )}
    </div>
  );
}
