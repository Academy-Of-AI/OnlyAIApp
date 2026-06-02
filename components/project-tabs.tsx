"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Project = {
  id: string;
  name: string;
  status: string;
  template_id: string;
  github_repo_url: string | null;
  vercel_preview_url: string | null;
  vercel_project_id: string | null;
  supabase_project_ref: string | null;
  error: string | null;
  created_at: string;
  deployed_at: string | null;
  build_prompt: string | null;
};

const TABS = ["Build", "Launch", "Analytics", "CRM", "Settings"] as const;
type Tab = (typeof TABS)[number];

export function ProjectTabs({
  project,
  buildCredits = 0,
  aiBuildEnabled = false,
}: {
  project: Project;
  buildCredits?: number;
  aiBuildEnabled?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Build");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-8 border-b border-white/10 pb-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-green-500 text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Build"     && <BuildTab project={project} buildCredits={buildCredits} aiBuildEnabled={aiBuildEnabled} />}
      {tab === "Launch"    && <LaunchTab project={project} />}
      {tab === "Analytics" && <ComingSoonTab title="Analytics" desc="Once your app has real users, their activity will appear here — signups, active users, activation funnel, and revenue." icon="📊" />}
      {tab === "CRM"       && <ComingSoonTab title="CRM" desc="Every user who signs up to your app will appear here. See who they are, what they've done, and send them emails directly." icon="👥" />}
      {tab === "Settings"  && <SettingsTab project={project} />}
    </div>
  );
}

/* ── Build tab ─────────────────────────────────────────────────────────── */
const BUILD_STEPS = [
  { key: "reading",    label: "Reading your app" },
  { key: "generating", label: "Building it with the agent" },
  { key: "pushing",    label: "Saving changes to GitHub" },
  { key: "deploying",  label: "Deploying & verifying it builds" },
] as const;
const STEP_INDEX: Record<string, number> = { reading: 0, generating: 1, pushing: 2, deploying: 3 };

function BuildTab({
  project,
  buildCredits,
  aiBuildEnabled,
}: {
  project: Project;
  buildCredits: number;
  aiBuildEnabled: boolean;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const repo = project.github_repo_url;
  const cloneCmd = repo ? `git clone ${repo}` : "";
  const runCmd = `cd ${project.name} && claude`;

  // VAB-drives generate flow
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(-1);
  const [result, setResult] = useState<{ ok: boolean; url: string | null; message?: string } | null>(null);
  const [buildErr, setBuildErr] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  function copy(label: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  async function runBuild() {
    if (!prompt.trim() || running || !repo) return;
    setRunning(true); setResult(null); setBuildErr(null); setStepIdx(0);
    try {
      const res = await fetch(`/api/projects/${project.id}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        setBuildErr(data.error ?? "Build couldn't start.");
        setRunning(false); setStepIdx(-1);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          let evt: { step?: string; url?: string | null; message?: string; deployed?: boolean };
          try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }
          const s = evt.step ?? "";
          if (s in STEP_INDEX) setStepIdx(STEP_INDEX[s]);
          if (s === "done") {
            setStepIdx(3);
            setResult({ ok: true, url: evt.url ?? null, message: evt.deployed === false ? (evt.message ?? "Deploy still building.") : undefined });
          } else if (s === "deploy_failed") {
            setResult({ ok: false, url: evt.url ?? null, message: evt.message ?? "The deploy failed to build." });
          } else if (s === "error") {
            setBuildErr(evt.message ?? "Build failed.");
          }
        }
      }
    } catch (e) {
      setBuildErr(e instanceof Error ? e.message : "Build failed.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  async function buyCredits() {
    setBuying(true);
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: "starter" }),
      });
      const data = await res.json().catch(() => ({} as { url?: string }));
      if (data.url) { window.location.href = data.url; return; }
      setBuying(false);
    } catch { setBuying(false); }
  }

  const showProgress = running || result !== null || stepIdx >= 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Build it</h2>
        <p className="text-sm text-neutral-400">
          Describe what you want and VAB builds it with the agent — kept on the reliable path.
          As you level up, take the wheel and drive it yourself.
        </p>
      </div>

      {/* VAB-drives Generate flow (only when owner-funded AI builds are switched on) */}
      {aiBuildEnabled && (
        <div className="border border-violet-500/25 bg-violet-500/[0.04] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold">✨ Let VAB build it for you</p>
            <span className="text-xs text-neutral-400">{buildCredits} build{buildCredits === 1 ? "" : "s"} left</span>
          </div>

          {buildCredits > 0 ? (
            <>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={running || !repo}
                rows={2}
                placeholder="e.g. Add a gap-scoring report per department"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-violet-500 resize-none disabled:opacity-50"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={runBuild}
                  disabled={running || !prompt.trim() || !repo}
                  className="bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {running ? "Building…" : "⬢ Build it (1 credit)"}
                </button>
                {!repo && <span className="text-xs text-amber-300">Finish provisioning first.</span>}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-400">
                You&apos;re out of builds. Get <b className="text-white">3 builds for $10</b> and VAB will build it for you.
              </p>
              <button
                onClick={buyCredits}
                disabled={buying}
                className="bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {buying ? "…" : "Get 3 builds for $10"}
              </button>
            </div>
          )}

          {/* Live progress */}
          {showProgress && (
            <div className="border-t border-white/10 pt-3 space-y-1.5">
              {BUILD_STEPS.map((st, i) => {
                const state =
                  result && !result.ok && i === 3 ? "fail"
                  : result?.ok || stepIdx > i ? "done"
                  : stepIdx === i && running ? "now"
                  : "todo";
                const icon = state === "done" ? "✓" : state === "fail" ? "✕" : state === "now" ? "●" : "○";
                const color =
                  state === "done" ? "text-green-400"
                  : state === "fail" ? "text-red-400"
                  : state === "now" ? "text-violet-400"
                  : "text-neutral-600";
                return (
                  <div key={st.key} className="flex items-center gap-2 text-sm">
                    <span className={`${color} w-4 text-center`}>{icon}</span>
                    <span className={state === "todo" ? "text-neutral-600" : "text-neutral-300"}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Outcome */}
          {result?.ok && (
            <div className="text-sm">
              <p className="text-green-400 font-medium">{result.message ? "Committed ✓" : "Live ✓"}</p>
              {result.message && <p className="text-xs text-neutral-400 mt-1">{result.message}</p>}
              {result.url && (
                <a href={result.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-violet-300 hover:underline">
                  ↗ Open your app
                </a>
              )}
            </div>
          )}
          {result && !result.ok && (
            <div className="text-sm border border-red-500/30 bg-red-500/5 rounded-lg p-3">
              <p className="text-red-400 font-medium">Deploy didn&apos;t build</p>
              <p className="text-xs text-neutral-300 mt-1">{result.message}</p>
            </div>
          )}
          {buildErr && <p className="text-xs text-red-400">{buildErr}</p>}
        </div>
      )}

      {/* Graduation / drive-it-yourself (handoff) */}
      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          {aiBuildEnabled ? "Prefer to drive it yourself? (graduation)" : "Build it with your own Claude Code"}
        </p>

      {!repo ? (
        <div className="border border-amber-500/25 bg-amber-500/5 rounded-xl p-4 text-sm text-amber-300">
          No GitHub repo is linked yet. Finish provisioning to get your code.
        </div>
      ) : (
        <ol className="space-y-3">
          {/* Step 1 — clone */}
          <li className="border border-white/10 rounded-xl p-4">
            <p className="text-sm font-medium mb-2"><span className="text-violet-400 mr-2">1</span>Get the code on your machine</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-violet-300 truncate">{cloneCmd}</code>
              <button onClick={() => copy("clone", cloneCmd)} className="text-xs border border-white/10 hover:border-white/30 px-3 py-2 rounded-lg transition-colors shrink-0">
                {copied === "clone" ? "Copied" : "Copy"}
              </button>
            </div>
          </li>

          {/* Step 2 — open with Claude Code */}
          <li className="border border-white/10 rounded-xl p-4">
            <p className="text-sm font-medium mb-2"><span className="text-violet-400 mr-2">2</span>Open it with Claude Code</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-violet-300 truncate">{runCmd}</code>
              <button onClick={() => copy("run", runCmd)} className="text-xs border border-white/10 hover:border-white/30 px-3 py-2 rounded-lg transition-colors shrink-0">
                {copied === "run" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              New to Claude Code? <Link href="/start" className="text-violet-300 hover:underline">Start here →</Link>
            </p>
          </li>

          {/* Step 3 — describe */}
          <li className="border border-white/10 rounded-xl p-4">
            <p className="text-sm font-medium mb-2"><span className="text-violet-400 mr-2">3</span>Tell it what you want</p>
            <p className="text-sm text-neutral-400">
              Just type your idea. We&apos;ve pre-loaded <code className="text-violet-300 text-xs">CLAUDE.md</code> with
              your objective, plan, and decisions — so the agent starts already knowing your project.
            </p>
          </li>
        </ol>
      )}
      </div>

      {/* Keep-on-track callout */}
      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">OnlyAIApp keeps it on track</p>
        <p className="text-sm text-neutral-400 leading-relaxed">
          As you build, your{" "}
          <Link href={`/projects/${project.id}/plan`} className="text-violet-300 hover:underline">Plan</Link>,{" "}
          <Link href={`/projects/${project.id}/memory`} className="text-violet-300 hover:underline">Memory</Link>, and{" "}
          <Link href={`/projects/${project.id}/drift`} className="text-violet-300 hover:underline">Course-keeper</Link>{" "}
          update from your commits — so your agent stays anchored to your goal instead of wandering.
        </p>
      </div>

      {/* Links */}
      <div className="flex gap-3 flex-wrap">
        {repo && (
          <a href={repo} target="_blank" rel="noopener noreferrer"
            className="border border-white/10 hover:border-white/20 text-sm text-neutral-300 px-4 py-2 rounded-lg transition-colors">
            GitHub repo →
          </a>
        )}
        {project.vercel_preview_url && (
          <a href={project.vercel_preview_url} target="_blank" rel="noopener noreferrer"
            className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
            ↗ Open live app
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Launch tab — launch-readiness checks + Claude Code fix tasks ─────────── */
function LaunchTab({ project }: { project: Project }) {
  type Check = { id: string; label: string; status: "pass" | "fail" | "warn" | "unknown"; detail: string; claudeTask?: string };
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/launch-check`);
      const data = await res.json();
      setChecks(Array.isArray(data.checks) ? data.checks : []);
    } catch {
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }

  function copy(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  const icon = (s: Check["status"]) => (s === "pass" ? "✓" : s === "fail" ? "✕" : s === "warn" ? "!" : "○");
  const color = (s: Check["status"]) => (s === "pass" ? "text-green-400" : s === "fail" ? "text-red-400" : s === "warn" ? "text-amber-400" : "text-neutral-500");
  const remaining = checks?.filter((c) => c.status === "fail" || c.status === "warn").length ?? 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Launch readiness</h2>
        <p className="text-sm text-neutral-400">
          We check what separates &quot;it built&quot; from &quot;it&apos;s actually launched&quot; — then hand you the exact task to
          paste into your Claude Code for anything that isn&apos;t ready yet.
        </p>
      </div>

      {!checks && (
        <button onClick={run} disabled={loading}
          className="bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          {loading ? "Checking…" : "Check launch readiness"}
        </button>
      )}

      {checks && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-neutral-400">
              {remaining === 0 ? "🎉 All clear — you're launch-ready." : `${remaining} thing${remaining === 1 ? "" : "s"} left before launch.`}
            </p>
            <button onClick={run} disabled={loading}
              className="text-xs border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors">
              {loading ? "…" : "Re-check"}
            </button>
          </div>

          <div className="space-y-3">
            {checks.map((c) => (
              <div key={c.id} className="border border-white/10 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className={`${color(c.status)} font-bold w-4 text-center`}>{icon(c.status)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{c.detail}</p>
                    {c.claudeTask && (
                      <div className="mt-3 flex items-start gap-2">
                        <code className="flex-1 text-xs font-mono bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-violet-300 leading-relaxed">{c.claudeTask}</code>
                        <button onClick={() => copy(c.id, c.claudeTask!)}
                          className="text-xs border border-white/10 hover:border-white/30 px-3 py-2 rounded-lg transition-colors shrink-0">
                          {copied === c.id ? "Copied" : "Copy task"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-600">Paste a task into your Claude Code, let it fix it, push — then hit Re-check.</p>
        </>
      )}
    </div>
  );
}

/* ── Coming soon placeholder ────────────────────────────────────────────── */
function ComingSoonTab({ title, desc, icon }: { title: string; desc: string; icon: string }) {
  return (
    <div className="max-w-lg">
      <div className="border border-white/10 rounded-xl p-8 text-center space-y-3">
        <div className="text-4xl">{icon}</div>
        <h2 className="font-semibold text-lg">{title}</h2>
        <p className="text-sm text-neutral-400 leading-relaxed">{desc}</p>
        <span className="inline-block text-xs bg-white/5 border border-white/10 text-neutral-500 px-3 py-1 rounded-full mt-2">
          Coming in Module 2
        </span>
      </div>
    </div>
  );
}

/* ── Settings tab ───────────────────────────────────────────────────────── */
function SettingsTab({ project }: { project: Project }) {
  const router = useRouter();
  const [name, setName]               = useState(project.name);
  const [url, setUrl]                 = useState(project.vercel_preview_url ?? "");
  const [editingName, setEditingName] = useState(false);
  const [editingUrl, setEditingUrl]   = useState(false);
  const [saving, setSaving]           = useState<"name" | "url" | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [saved, setSaved]             = useState<"name" | "url" | null>(null);

  async function save(field: "name" | "url") {
    setError(null);
    setSaving(field);
    const body =
      field === "name" ? { name } : { vercel_preview_url: url };

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Save failed");
    } else {
      if (field === "name") setEditingName(false);
      if (field === "url")  setEditingUrl(false);
      setSaved(field);
      setTimeout(() => setSaved(null), 2000);
      // Re-fetch server component so other tabs (e.g. Build) see the new URL
      router.refresh();
    }
  }

  function copyToClipboard(value: string) {
    navigator.clipboard.writeText(value);
  }

  const readOnlyRows: { label: string; value: string | null; href?: string; copy?: boolean }[] = [
    { label: "Status",         value: project.status },
    { label: "Created",        value: new Date(project.created_at).toLocaleString() },
    { label: "Deployed",       value: project.deployed_at ? new Date(project.deployed_at).toLocaleString() : "—" },
    { label: "GitHub repo",    value: project.github_repo_url, href: project.github_repo_url ?? undefined },
    { label: "Supabase ref",   value: project.supabase_project_ref, copy: true },
    { label: "Vercel project", value: project.vercel_project_id },
  ];

  return (
    <div className="max-w-xl space-y-6">
      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold mb-4">Project details</h2>
        <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/[0.06]">

          {/* Editable: name */}
          <div className="flex items-center justify-between px-5 py-3 text-sm gap-4">
            <span className="text-neutral-500 w-36 shrink-0">Project name</span>
            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
              {editingName ? (
                <>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-white/5 border border-white/15 rounded-md px-2 py-1 text-sm text-white outline-none focus:border-green-500/50 w-48"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save("name");
                      if (e.key === "Escape") { setName(project.name); setEditingName(false); }
                    }}
                  />
                  <button
                    onClick={() => save("name")}
                    disabled={saving === "name"}
                    className="text-xs bg-green-500 hover:bg-green-400 text-black font-semibold px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                  >
                    {saving === "name" ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setName(project.name); setEditingName(false); }}
                    className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="text-neutral-300 truncate">{name}</span>
                  {saved === "name" && <span className="text-xs text-green-400">Saved ✓</span>}
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-neutral-600 hover:text-neutral-300 text-xs transition-colors ml-1"
                    title="Edit"
                  >✎</button>
                </>
              )}
            </div>
          </div>

          {/* Editable: live URL */}
          <div className="flex items-center justify-between px-5 py-3 text-sm gap-4">
            <span className="text-neutral-500 w-36 shrink-0">Live URL</span>
            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
              {editingUrl ? (
                <>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="bg-white/5 border border-white/15 rounded-md px-2 py-1 text-sm text-white outline-none focus:border-green-500/50 w-56"
                    autoFocus
                    placeholder="https://your-app.vercel.app"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save("url");
                      if (e.key === "Escape") { setUrl(project.vercel_preview_url ?? ""); setEditingUrl(false); }
                    }}
                  />
                  <button
                    onClick={() => save("url")}
                    disabled={saving === "url"}
                    className="text-xs bg-green-500 hover:bg-green-400 text-black font-semibold px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                  >
                    {saving === "url" ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setUrl(project.vercel_preview_url ?? ""); setEditingUrl(false); }}
                    className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 truncate transition-colors"
                    >
                      {url}
                    </a>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                  {saved === "url" && <span className="text-xs text-green-400">Saved ✓</span>}
                  <button
                    onClick={() => setEditingUrl(true)}
                    className="text-neutral-600 hover:text-neutral-300 text-xs transition-colors ml-1"
                    title="Edit"
                  >✎</button>
                </>
              )}
            </div>
          </div>

          {/* Read-only rows */}
          {readOnlyRows.map(({ label, value, href, copy }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-neutral-500 w-36 shrink-0">{label}</span>
              <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                {href && value ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300 truncate transition-colors"
                  >
                    {value}
                  </a>
                ) : (
                  <span className="text-neutral-300 truncate">{value ?? "—"}</span>
                )}
                {copy && value && (
                  <button
                    onClick={() => copyToClipboard(value)}
                    className="text-neutral-600 hover:text-neutral-400 text-xs shrink-0 transition-colors"
                    title="Copy"
                  >
                    ⎘
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-white/10 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold">Manage connections</h3>
        <p className="text-xs text-neutral-500 leading-relaxed">
          Need to update your Vercel token, Supabase access, or Resend key?
          Go back to your dashboard to reconnect or update any integration.
        </p>
        <a
          href="/dashboard"
          className="inline-block text-sm text-green-400 hover:text-green-300 transition-colors"
        >
          ← Back to dashboard &amp; connections
        </a>
      </div>
    </div>
  );
}
