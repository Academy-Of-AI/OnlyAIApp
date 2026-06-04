"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { QuickMockup } from "@/components/quick-mockup";

type Project = {
  id: string;
  name: string;
  github_repo_url: string | null;
  build_prompt: string | null;
};

type Plan = { now?: string[]; next?: string[]; later?: string[] };
type Sprint = { title: string; items: string[] };
type DocFile = { path: string; content: string };
export type Result = {
  files: DocFile[];
  plan: Plan | null;
  sprints: Sprint[];
  summary: string;
  repoUrl: string | null;
  commitEmail?: string | null;
  commitName?: string | null;
};

// "Bring your own docs" payload handed over from the Scope (Start here) page.
type UploadDoc = { name: string; content: string; kind: "prd" | "skill" };
type UploadMode = "ground_truth" | "skip";

const PROGRESS = [
  { key: "planning", label: "Designing the plan (PRD, architecture, sprints)" },
  { key: "wiring", label: "Wiring your database (applying the schema)" },
  { key: "committing", label: "Saving the pack to your repo" },
  { key: "done", label: "Ready to hand to your agent" },
];
const PROGRESS_INDEX: Record<string, number> = {
  planning: 0, planning_done: 0,
  wiring: 1, wiring_done: 1, wiring_skip: 1,
  committing: 2, done: 3,
};

const TABS = ["Describe", "Plan", "Sprints", "Hand off"] as const;
type TabName = (typeof TABS)[number];

// The grounding kickoff prompt — names the spec so the agent can't drift into a
// marketing landing page. Matches the binding rules in the generated CLAUDE.md.
const KICKOFF = "Read everything in /docs, confirm the plan in 3 lines, then build Sprint 1 from TASKS.md — your database schema is already applied, so run `vercel env pull .env.local` and build on the existing tables, commit + push to deploy, the real working app, not a landing page.";

export function PlanPack({
  project, initialPack = null, buildCredits = 0,
}: {
  project: Project;
  initialPack?: Result | null;
  buildCredits?: number;
}) {
  const router = useRouter();
  const repo = project.github_repo_url;
  const cleanRepo = repo ? repo.replace(/\.git$/, "") : "";
  const repoDir = cleanRepo ? (cleanRepo.split("/").pop() || project.name) : project.name;

  const [idea, setIdea] = useState(project.build_prompt ?? "");
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(-1);
  const [result, setResult] = useState<Result | null>(initialPack);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<TabName>(initialPack ? "Plan" : "Describe");
  const [activeDoc, setActiveDoc] = useState(0);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Docs the user uploaded on "Start here" (optional power-user path).
  const [uploadDocs, setUploadDocs] = useState<UploadDoc[] | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>("ground_truth");
  const consumedUpload = useRef(false);

  // One paste: clone, enter the folder, pin the git identity (so Vercel doesn't
  // block deploys), then launch the agent with the kickoff baked in. The identity
  // comes from the pack (server-derived GitHub no-reply email).
  const commitEmail = result?.commitEmail ?? initialPack?.commitEmail ?? null;
  const commitName = result?.commitName ?? initialPack?.commitName ?? null;
  const gitIdentCmd = commitEmail && commitName
    ? ` && git config user.email "${commitEmail}" && git config user.name "${commitName}"`
    : "";
  const handoffCmd = repo ? `git clone ${cleanRepo} && cd ${repoDir}${gitIdentCmd} && claude '${KICKOFF}'` : "";

  // Live timer while generating (resets when it stops).
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // Persist the pack locally so it survives tab switches AND refresh with no
  // round-trip. A DB-provided pack (initialPack) takes priority when present.
  useEffect(() => {
    if (initialPack) return;
    try {
      const raw = localStorage.getItem(`planpack:${project.id}`);
      if (raw) { setResult(JSON.parse(raw) as Result); setTab("Plan"); }
    } catch { /* ignore */ }
  }, [project.id, initialPack]);

  useEffect(() => {
    if (!result) return;
    try { localStorage.setItem(`planpack:${project.id}`, JSON.stringify(result)); } catch { /* ignore */ }
  }, [result, project.id]);

  // Pick up docs handed over from "Start here" (project-scoped, consumed once).
  // We don't auto-run — the builder confirms with one click so they see the mode
  // and don't accidentally re-spend on a project that already has a pack.
  useEffect(() => {
    if (consumedUpload.current || initialPack || result) return;
    try {
      const raw = sessionStorage.getItem(`scopeUpload:${project.id}`);
      if (!raw) return;
      consumedUpload.current = true;
      sessionStorage.removeItem(`scopeUpload:${project.id}`);
      const payload = JSON.parse(raw) as { docs?: UploadDoc[]; mode?: UploadMode };
      const ds = (payload.docs ?? []).filter((d) => d && d.content);
      if (ds.length === 0) return;
      setUploadDocs(ds);
      setUploadMode(payload.mode === "skip" ? "skip" : "ground_truth");
      setIdea((cur) => {
        if (cur.trim()) return cur;
        const prd = ds.filter((d) => d.kind !== "skill");
        return (prd.length ? prd : ds).map((d) => `# ${d.name}\n\n${d.content}`).join("\n\n---\n\n");
      });
      setTab("Describe");
    } catch { /* ignore */ }
  }, [project.id, initialPack, result]);

  async function generate() {
    if (!idea.trim() || running || !repo) return;
    setRunning(true); setErr(null); setResult(null); setStepIdx(0);
    try {
      const res = await fetch(`/api/projects/${project.id}/plan-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: idea.trim(),
          ...(uploadDocs && uploadDocs.length > 0 ? { docs: uploadDocs, mode: uploadMode } : {}),
        }),
      });
      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({} as { error?: string }));
        setErr(d.error ?? "Couldn't start."); setRunning(false); setStepIdx(-1); return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let gotTerminal = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          let evt: {
            step?: string; message?: string;
            files?: DocFile[]; plan?: Plan; sprints?: Sprint[]; summary?: string; repoUrl?: string | null;
            commitEmail?: string | null; commitName?: string | null;
          };
          try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
          const s = evt.step ?? "";
          if (s in PROGRESS_INDEX) setStepIdx(PROGRESS_INDEX[s]);
          if (s === "done") {
            setStepIdx(PROGRESS.length - 1);
            setResult({
              files: evt.files ?? [],
              plan: evt.plan ?? null,
              sprints: evt.sprints ?? [],
              summary: evt.summary ?? project.name,
              repoUrl: evt.repoUrl ?? repo,
              commitEmail: evt.commitEmail ?? null,
              commitName: evt.commitName ?? null,
            });
            setActiveDoc(0);
            setTab("Plan");
            gotTerminal = true;
          } else if (s === "error") {
            setErr(evt.message ?? "Plan generation failed.");
            gotTerminal = true;
          }
        }
      }
      if (!gotTerminal) setErr("This took longer than expected and may have timed out — try again, or shorten your idea a little.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Plan generation failed.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  const unlocked = !!result;
  const allFiles = result?.files ?? [];
  const shownFile = allFiles[activeDoc] ?? allFiles[0];

  function copy(text: string) {
    navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border border-violet-500/30 bg-violet-500/[0.05] rounded-xl overflow-hidden">
      {/* header */}
      <div className="px-4 sm:px-5 pt-4 pb-3 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold">📋 Your Plan Pack</p>
      </div>

      {/* tab bar */}
      <div className="flex gap-1 px-2 border-b border-white/10 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const enabled = t === "Describe" || unlocked;
          return (
            <button
              key={t}
              onClick={() => enabled && setTab(t)}
              disabled={!enabled}
              className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t ? "border-violet-500 text-white"
                : enabled ? "border-transparent text-neutral-400 hover:text-neutral-200"
                : "border-transparent text-neutral-700 cursor-not-allowed"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="p-4 sm:p-5">
        {/* DESCRIBE */}
        {tab === "Describe" && (
          <div className="space-y-3">
            {uploadDocs && uploadDocs.length > 0 && !result ? (
              <div className="border border-violet-500/30 bg-violet-500/[0.06] rounded-lg p-3 space-y-1.5">
                <p className="text-sm text-violet-200 font-medium">
                  📄 Loaded {uploadDocs.length} doc{uploadDocs.length === 1 ? "" : "s"} from Start here
                  {(() => {
                    const p = uploadDocs.filter((d) => d.kind !== "skill").length;
                    const s = uploadDocs.length - p;
                    return ` (${p} plan · ${s} skill)`;
                  })()}
                </p>
                <p className="text-xs text-neutral-400">
                  {uploadMode === "skip"
                    ? "Mode: Skip planning — we'll commit your docs as-is, set up your database from them, and put any skill specs in .claude/skills/. Fast."
                    : "Mode: Use my docs as the source of truth — we'll structure them into the plan, fill gaps, and build your database from them."}
                </p>
              </div>
            ) : (
              <p className="text-xs text-neutral-400">
                Describe what you want to deliver. We turn it into a clear, well-sequenced plan and commit it to
                <span className="text-violet-300"> /docs</span> — so your agent starts knowing exactly what to build.
              </p>
            )}
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              disabled={running || !repo}
              rows={3}
              placeholder="e.g. A tool to run my consultancy: capture leads from calls, auto-draft proposals, track who's paid, and tell me who to follow up with today. For me + 2 associates."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-violet-500 resize-none disabled:opacity-50"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={generate}
                disabled={running || !idea.trim() || !repo}
                className="bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {running ? "Generating…"
                  : result ? "✦ Change the plan"
                  : uploadDocs && uploadMode === "skip" ? "✦ Set up repo + database from my docs"
                  : uploadDocs ? "✦ Generate plan from my docs"
                  : "✦ Generate the Plan Pack"}
              </button>
              {!repo && <span className="text-xs text-amber-300">Finish provisioning first.</span>}
            </div>

            {(running || (stepIdx >= 0 && !result)) && (
              <div className="border-t border-white/10 pt-3 space-y-1.5">
                {running && (
                  <p className="text-xs text-neutral-500 mb-1">
                    ⏳ Working… {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} · {uploadDocs && uploadMode === "skip" ? "this is quick — usually under a minute" : "this usually takes 3–5 minutes"}
                  </p>
                )}
                {(uploadDocs && uploadMode === "skip"
                  ? [{ key: "planning", label: "Reading your docs" }, ...PROGRESS.slice(1)]
                  : PROGRESS
                ).map((st, i) => {
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
            {result && <p className="text-xs text-green-400">✓ Plan pack committed — see the Plan, Docs, Sprints and Hand off tabs.</p>}
          </div>
        )}

        {/* PLAN — sequencing + the generated docs (consolidated) */}
        {tab === "Plan" && result && (
          <div className="space-y-4">
            {result.summary && <p className="text-sm text-neutral-300">{result.summary}</p>}
            <div className="space-y-2">
              <p className="text-xs text-neutral-500 uppercase tracking-wider">Your build, sequenced</p>
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <PlanColumn title="Now" badge="v1" tone="green" items={result.plan?.now} />
                <PlanColumn title="Next" badge="soon" tone="amber" items={result.plan?.next} />
                <PlanColumn title="Later" badge="when ready" tone="neutral" items={result.plan?.later} />
              </div>
              <p className="text-xs text-neutral-600">Built data-first, so the core keeps working reliably — even with the AI switched off.</p>
            </div>
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs text-neutral-500 uppercase tracking-wider">The pack — committed to <span className="font-mono">/docs</span></p>
              <div className="flex flex-wrap gap-1.5">
                {allFiles.map((f, i) => (
                  <button
                    key={f.path}
                    onClick={() => setActiveDoc(i)}
                    className={`text-[11px] font-mono rounded px-1.5 py-0.5 border transition-colors ${
                      i === activeDoc ? "bg-violet-500/15 border-violet-500/50 text-violet-200"
                      : "border-white/10 text-neutral-400 hover:text-neutral-200"
                    }`}
                  >{f.path}</button>
                ))}
              </div>
              {shownFile && (
                <div className="bg-black/40 border border-white/10 rounded-lg p-3 max-h-[400px] overflow-auto">
                  <pre className="text-xs leading-relaxed text-neutral-300 whitespace-pre-wrap font-mono">{shownFile.content}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SPRINTS */}
        {tab === "Sprints" && result && (
          <div className="space-y-3">
            {result.sprints.length === 0 ? (
              <p className="text-sm text-neutral-500">See <span className="font-mono">docs/TASKS.md</span> in the Plan tab for the sprint plan.</p>
            ) : (
              result.sprints.map((s, i) => (
                <div key={i} className="border border-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-mono bg-violet-500/15 text-violet-200 border border-violet-500/30 rounded px-1.5 py-0.5">Sprint {i + 1}</span>
                    <span className="text-sm font-medium text-neutral-200">{s.title}</span>
                  </div>
                  <ul className="space-y-1">
                    {s.items.map((it, j) => (
                      <li key={j} className="text-xs text-neutral-400 flex gap-2"><span className="text-neutral-600">○</span>{it}</li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}

        {/* HAND OFF */}
        {tab === "Hand off" && result && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-300">One command — clone the repo and start your agent with the plan baked in. It already knows what to build (your CLAUDE.md enforces it).</p>
            <div className="flex items-start gap-2">
              <code className="flex-1 text-xs font-mono bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-violet-300 leading-relaxed break-words whitespace-pre-wrap">{handoffCmd}</code>
              <button onClick={() => copy(handoffCmd)} className="text-xs border border-white/10 hover:border-white/30 px-3 py-2 rounded-lg transition-colors shrink-0">{copied ? "Copied" : "Copy"}</button>
            </div>
            {commitEmail && (
              <p className="text-xs text-neutral-600">
                Sets your git identity to <span className="font-mono text-neutral-500">{commitEmail}</span> so Vercel
                won&apos;t block your first deploy (a commit email it can&apos;t match to your GitHub account).
              </p>
            )}
            {result.repoUrl && (
              <a href={`${result.repoUrl.replace(/\.git$/, "")}/tree/main/docs`} target="_blank" rel="noopener noreferrer"
                className="inline-block text-sm text-violet-300 hover:underline">View the pack on GitHub →</a>
            )}
            <QuickMockup project={project} buildCredits={buildCredits} idea={idea} />
          </div>
        )}
      </div>
    </div>
  );
}

function PlanColumn({ title, badge, tone, items }: { title: string; badge: string; tone: "green" | "amber" | "neutral"; items?: string[] }) {
  // Calm palette: these are phases, not statuses — keep them neutral. "Now" (the
  // v1 focus) gets a subtle violet accent on its badge; that's the only color.
  const toneCls = "bg-white/[0.02] border-white/10";
  const badgeCls =
    tone === "green" ? "text-violet-300 border-violet-500/30"
    : "text-neutral-400 border-white/15";
  return (
    <div className={`rounded-xl p-4 border ${toneCls}`}>
      <div className="flex items-center justify-between mb-2">
        <b>{title}</b>
        <span className={`text-[10px] border rounded-full px-2 py-0.5 ${badgeCls}`}>{badge}</span>
      </div>
      <ul className="text-xs space-y-1.5 text-neutral-300">
        {(items && items.length > 0 ? items : ["—"]).map((it, i) => <li key={i}>• {it}</li>)}
      </ul>
    </div>
  );
}
