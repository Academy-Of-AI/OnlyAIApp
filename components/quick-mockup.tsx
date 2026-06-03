"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Project = { id: string; name: string; github_repo_url: string | null; build_prompt: string | null };

const STEPS = [
  { key: "reading", label: "Reading your app" },
  { key: "generating", label: "Sketching the mockup" },
  { key: "pushing", label: "Saving to GitHub" },
  { key: "deploying", label: "Deploying it" },
] as const;
const STEP_INDEX: Record<string, number> = { reading: 0, generating: 1, pushing: 2, deploying: 3 };

/** A quick, static visual mockup of the app — no backend. Lives in the Plan
 *  Pack's "Hand off" tab so the front of the Build tab stays just the plan. */
export function QuickMockup({ project, buildCredits }: { project: Project; buildCredits: number }) {
  const router = useRouter();
  const repo = project.github_repo_url;
  const idea = project.build_prompt ?? "";
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(-1);
  const [result, setResult] = useState<{ ok: boolean; url: string | null; message?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  async function run() {
    if (running || !repo || !idea.trim()) return;
    setRunning(true); setErr(null); setResult(null); setStepIdx(0);
    try {
      const res = await fetch(`/api/projects/${project.id}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: idea.trim(), mock: true }),
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
          let evt: { step?: string; url?: string | null; message?: string; deployed?: boolean };
          try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
          const s = evt.step ?? "";
          if (s in STEP_INDEX) setStepIdx(STEP_INDEX[s]);
          if (s === "done") { setStepIdx(3); setResult({ ok: true, url: evt.url ?? null, message: evt.deployed === false ? (evt.message ?? "Deploy still building.") : undefined }); }
          else if (s === "deploy_failed") { setResult({ ok: false, url: evt.url ?? null, message: evt.message ?? "The deploy failed to build." }); }
          else if (s === "error") { setErr(evt.message ?? "Mockup failed."); }
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Mockup failed.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  async function buy() {
    setBuying(true);
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: "starter", projectId: project.id }),
      });
      const d = await res.json().catch(() => ({} as { url?: string }));
      if (d.url) { window.location.href = d.url; return; }
      setBuying(false);
    } catch { setBuying(false); }
  }

  const showProgress = running || result !== null || stepIdx >= 0;

  return (
    <div className="border-t border-white/10 pt-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium">✨ Or — see a quick mockup first</p>
        <span className="text-[11px] text-neutral-500">{buildCredits} credit{buildCredits === 1 ? "" : "s"} left</span>
      </div>
      <p className="text-xs text-neutral-500">A fast, static visual of your app — no backend. Good for a gut-check before building.</p>

      {buildCredits > 0 ? (
        <button
          onClick={run}
          disabled={running || !repo || !idea.trim()}
          className="bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {running ? "Sketching…" : "⬢ Generate a quick mockup (1 credit)"}
        </button>
      ) : (
        <button onClick={buy} disabled={buying} className="bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          {buying ? "…" : "Get 3 credits for $10"}
        </button>
      )}
      {!idea.trim() && <p className="text-xs text-amber-300">Describe your idea in the Describe tab first.</p>}

      {showProgress && (
        <div className="space-y-1.5 pt-1">
          {STEPS.map((st, i) => {
            const state = result && !result.ok && i === 3 ? "fail" : result?.ok || stepIdx > i ? "done" : stepIdx === i && running ? "now" : "todo";
            const icon = state === "done" ? "✓" : state === "fail" ? "✕" : state === "now" ? "●" : "○";
            const color = state === "done" ? "text-green-400" : state === "fail" ? "text-red-400" : state === "now" ? "text-violet-400" : "text-neutral-600";
            return (
              <div key={st.key} className="flex items-center gap-2 text-sm">
                <span className={`${color} w-4 text-center`}>{icon}</span>
                <span className={state === "todo" ? "text-neutral-600" : "text-neutral-300"}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
      {result?.ok && result.url && (
        <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-violet-300 hover:underline">↗ Open the mockup</a>
      )}
      {result && !result.ok && <p className="text-xs text-red-400">{result.message}</p>}
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
