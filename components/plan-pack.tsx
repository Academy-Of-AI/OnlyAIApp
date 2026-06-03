"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  github_repo_url: string | null;
  build_prompt: string | null;
};

const STEPS = [
  { key: "planning", label: "Designing the plan (PRD, architecture, sprints)" },
  { key: "committing", label: "Saving the pack to your repo" },
  { key: "done", label: "Ready to hand to your agent" },
];
const STEP_INDEX: Record<string, number> = { planning: 0, planning_done: 0, committing: 1, done: 2 };

export function PlanPack({ project }: { project: Project }) {
  const router = useRouter();
  const repo = project.github_repo_url;
  const [idea, setIdea] = useState(project.build_prompt ?? "");
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(-1);
  const [files, setFiles] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const cloneCmd = repo ? `git clone ${repo.replace(/\.git$/, "")} && cd ${project.name} && claude` : "";

  async function generate() {
    if (!idea.trim() || running || !repo) return;
    setRunning(true); setErr(null); setFiles(null); setStepIdx(0);
    try {
      const res = await fetch(`/api/projects/${project.id}/plan-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({} as { error?: string }));
        setErr(d.error ?? "Couldn't start."); setRunning(false); setStepIdx(-1); return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          let evt: { step?: string; message?: string; files?: string[] };
          try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
          const s = evt.step ?? "";
          if (s in STEP_INDEX) setStepIdx(STEP_INDEX[s]);
          if (s === "done") { setStepIdx(2); setFiles(evt.files ?? []); }
          else if (s === "error") { setErr(evt.message ?? "Plan generation failed."); }
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Plan generation failed.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="border border-violet-500/30 bg-violet-500/[0.05] rounded-xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold">📋 Generate your Plan Pack</p>
        <span className="text-[11px] text-neutral-400">PRD · architecture · data model · sprints → your repo</span>
      </div>
      <p className="text-xs text-neutral-400">
        Describe what you want to deliver. We turn it into a world-class plan (built on the AI-App-Building
        method) and commit it to <span className="text-violet-300">/docs</span> — so your agent starts knowing
        exactly what to build, in what order.
      </p>

      {!files ? (
        <>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            disabled={running || !repo}
            rows={3}
            placeholder="e.g. A tool to run my consultancy: capture leads from sales calls, auto-draft proposals, track who's paid, and tell me who to follow up with today. For me + 2 associates."
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-violet-500 resize-none disabled:opacity-50"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={generate}
              disabled={running || !idea.trim() || !repo}
              className="bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {running ? "Generating…" : "✦ Generate the Plan Pack"}
            </button>
            {!repo && <span className="text-xs text-amber-300">Finish provisioning first.</span>}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-green-400 font-medium">✓ Plan pack committed to your repo</p>
          <div className="flex flex-wrap gap-1.5">
            {files.map((f) => (
              <span key={f} className="text-[11px] font-mono text-violet-200 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">{f}</span>
            ))}
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Hand it to your agent — it already knows the plan:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-violet-300 truncate">{cloneCmd}</code>
              <button
                onClick={() => { navigator.clipboard?.writeText(cloneCmd); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="text-xs border border-white/10 hover:border-white/30 px-3 py-2 rounded-lg transition-colors shrink-0"
              >{copied ? "Copied" : "Copy"}</button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {repo && (
              <a href={`${repo.replace(/\.git$/, "")}/tree/main/docs`} target="_blank" rel="noopener noreferrer"
                className="text-sm text-violet-300 hover:underline">View the pack on GitHub →</a>
            )}
            <button onClick={() => { setFiles(null); setStepIdx(-1); }} className="text-sm text-neutral-400 hover:text-white">Regenerate</button>
          </div>
        </div>
      )}

      {/* progress */}
      {(running || stepIdx >= 0) && !files && (
        <div className="border-t border-white/10 pt-3 space-y-1.5">
          {STEPS.map((st, i) => {
            const state = stepIdx > i ? "done" : stepIdx === i && running ? "now" : stepIdx === i ? "done" : "todo";
            const icon = state === "done" ? "✓" : state === "now" ? "●" : "○";
            const color = state === "done" ? "text-green-400" : state === "now" ? "text-violet-400" : "text-neutral-600";
            return (
              <div key={st.key} className="flex items-center gap-2 text-sm">
                <span className={`${color} w-4 text-center`}>{icon}</span>
                <span className={state === "todo" ? "text-neutral-600" : "text-neutral-300"}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
