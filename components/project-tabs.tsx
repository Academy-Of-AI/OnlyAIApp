"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getDodItems } from "@/lib/blueprints";
import { PlanPack, type Result as PlanPackResult } from "@/components/plan-pack";
import { AutoCaptureToggle } from "@/components/auto-capture-toggle";
import { DeleteProjectButton } from "@/components/delete-project-button";

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
  last_digest: { onTrack: boolean; note: string; scopeCreep?: string[] } | null;
};

const STATUS_STYLES: Record<string, string> = {
  deployed:     "bg-green-500/20 text-green-400",
  provisioning: "bg-yellow-500/20 text-yellow-400",
  building:     "bg-blue-500/20 text-blue-400",
  pending:      "bg-neutral-500/20 text-neutral-400",
  failed:       "bg-red-500/20 text-red-400",
};

type View = "plan" | "pilot" | "settings";

export function ProjectTabs({
  project,
  buildCredits = 0,
  memory = [],
  liveUrl = null,
  initialPack = null,
  autoCapture = false,
}: {
  project: Project;
  buildCredits?: number;
  memory?: Array<{ kind: string; content: string }>;
  liveUrl?: string | null;
  initialPack?: PlanPackResult | null;
  autoCapture?: boolean;
}) {
  const [view, setView] = useState<View>("plan");
  const pnav = (active: boolean) =>
    `rounded-lg border px-3 py-2.5 flex items-center gap-2 transition-colors text-left ${
      active ? "border-violet-500/50 bg-violet-500/[0.08] text-white" : "border-white/10 text-neutral-300 hover:border-white/25"
    }`;

  return (
    <div>
      {/* Header — name, status, Settings gear, GitHub / Live app */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{project.name}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[project.status] ?? STATUS_STYLES.pending}`}>{project.status}</span>
            <button onClick={() => setView("settings")} title="Settings"
              className={`text-lg leading-none transition-colors ${view === "settings" ? "text-violet-300" : "text-neutral-500 hover:text-white"}`}>⚙</button>
          </div>
          <p className="text-sm text-neutral-500 mt-1">Created {new Date(project.created_at).toLocaleDateString()}</p>
          {project.error && <p className="text-xs text-red-400 mt-1 truncate max-w-lg">{project.error}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          {project.github_repo_url && (
            <a href={project.github_repo_url} target="_blank" rel="noopener noreferrer"
              className="border border-white/10 hover:border-white/20 text-sm text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">GitHub →</a>
          )}
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer"
              className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">↗ Live app</a>
          )}
        </div>
      </div>

      {/* The 3 Ps — the only nav (no tab bar) */}
      <div className="grid grid-cols-3 gap-2 text-sm mb-8">
        <div className="rounded-lg border border-green-500/20 bg-green-500/[0.05] px-3 py-2.5 flex items-center gap-2"><span className="text-green-400">①</span><span className="font-semibold">Provision</span><span className="ml-auto text-xs text-green-400">✓</span></div>
        <button onClick={() => setView("plan")} className={pnav(view === "plan")}><span className="text-violet-300">②</span><span className="font-semibold">Plan</span></button>
        <button onClick={() => setView("pilot")} className={pnav(view === "pilot")}><span className="text-violet-300">③</span><span className="font-semibold">Pilot</span></button>
      </div>

      {view === "plan" && <PlanView project={project} buildCredits={buildCredits} initialPack={initialPack} />}
      {view === "pilot" && <PilotView project={project} memory={memory} liveUrl={liveUrl} autoCapture={autoCapture} />}
      {view === "settings" && <SettingsTab project={project} />}
    </div>
  );
}

/* ── Plan view ─────────────────────────────────────────────────────────── */
function PlanView({
  project, buildCredits, initialPack = null,
}: {
  project: Project; buildCredits: number; initialPack?: PlanPackResult | null;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Plan it, then build it</h2>
        <p className="text-sm text-neutral-400">
          Start with a Plan Pack — a PRD, architecture, data model and sprint plan committed to your
          repo. Then hand it to your agent (Claude Code) to build it, the reliable way.
        </p>
      </div>
      <PlanPack project={project} initialPack={initialPack} buildCredits={buildCredits} />
    </div>
  );
}

/* ── Pilot view — keep it on course (auto-capture + drift + memory) & ship it ── */
function PilotView({
  project, memory = [], liveUrl = null, autoCapture = false,
}: {
  project: Project; memory?: Array<{ kind: string; content: string }>; liveUrl?: string | null; autoCapture?: boolean;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Pilot — keep it on course &amp; ship it</h2>
        <p className="text-sm text-neutral-400">As you build, Pilot tracks what changed, flags drift from your plan, and helps you launch.</p>
      </div>

      <AutoCaptureToggle projectId={project.id} enabled={autoCapture} />

      {project.last_digest && (
        <div className={`rounded-xl p-4 border ${project.last_digest.onTrack ? "border-green-500/25 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${project.last_digest.onTrack ? "text-green-400" : "text-amber-400"}`}>
            {project.last_digest.onTrack ? "✓ On track" : "⟲ Heads up"}
          </p>
          <p className="text-sm text-neutral-300">{project.last_digest.note}</p>
          {(project.last_digest.scopeCreep ?? []).length > 0 && (
            <ul className="mt-2 space-y-1">
              {(project.last_digest.scopeCreep ?? []).map((s, i) => (
                <li key={i} className="text-xs text-amber-300/90">• {s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {memory.length > 0 && (
        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">What OnlyAIApp remembers about this project</p>
          <div className="divide-y divide-white/[0.06]">
            {memory.map((mItem, i) => (
              <div key={i} className="flex gap-2 py-2 text-sm">
                <span className="text-[10px] text-neutral-500 bg-white/5 rounded px-1.5 py-0.5 h-fit whitespace-nowrap">{mItem.kind}</span>
                <span className="text-neutral-300">{mItem.content}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-600 mt-3">Picked up automatically as you build — so the AI always knows your project.</p>
        </div>
      )}

      <LaunchTab project={project} liveUrl={liveUrl} />
    </div>
  );
}

/* ── Launch tab — launch-readiness checks + Claude Code fix tasks ─────────── */
function LaunchTab({ project, liveUrl = null }: { project: Project; liveUrl?: string | null }) {
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

  // Definition of Done (client-side certainty gate for v1)
  const dodItems = getDodItems(project.template_id);
  const [dod, setDod] = useState<Record<string, boolean>>({});
  const allDod = dodItems.every((i) => dod[i.key]);
  const canSubmit = checks !== null && remaining === 0 && allDod;

  // Submit to The Wall (when launch-ready)
  const [wTitle, setWTitle] = useState(project.name);
  const [wTagline, setWTagline] = useState("");
  const [wDemo, setWDemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  async function submitToWall() {
    if (!wTitle.trim() || !wDemo.trim() || submitting) return;
    setSubmitting(true); setSubmitErr(null);
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, title: wTitle.trim(), tagline: wTagline.trim(), demoUrl: wDemo.trim() }),
      });
      const d = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) setSubmitErr(d.error ?? "Couldn't submit.");
      else setSubmitted(true);
    } catch {
      setSubmitErr("Couldn't submit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Launch readiness</h2>
        <p className="text-sm text-neutral-400">
          We check what separates &quot;it built&quot; from &quot;it&apos;s actually launched&quot; — then hand you the exact task to
          paste into your Claude Code for anything that isn&apos;t ready yet.
        </p>
      </div>

      {/* Definition of Done — the certainty gate */}
      <div className="border border-white/10 rounded-xl p-4 space-y-1">
        <p className="text-sm font-semibold mb-1">Definition of done</p>
        {dodItems.map((i) => (
          <label key={i.key} className="flex items-center gap-3 text-sm cursor-pointer py-1.5">
            <input
              type="checkbox"
              checked={!!dod[i.key]}
              onChange={(e) => setDod((d) => ({ ...d, [i.key]: e.target.checked }))}
              className="accent-violet-500 w-4 h-4 shrink-0"
            />
            <span className={dod[i.key] ? "text-neutral-500 line-through" : "text-neutral-300"}>{i.label}</span>
          </label>
        ))}
        <p className="text-xs text-neutral-600 pt-1">
          {allDod ? "✓ Done — now pass the launch checks below, then ship it to The Wall." : "Tick each as you finish it. All boxes + a clean launch check = ready to ship."}
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

          {canSubmit && (
            <div className="border border-violet-500/30 bg-violet-500/[0.05] rounded-xl p-4 space-y-3">
              {submitted ? (
                <div className="text-sm">
                  <p className="text-green-400 font-medium">🎉 Submitted to The Wall!</p>
                  <a href="/wall" target="_blank" rel="noopener noreferrer" className="text-violet-300 hover:underline text-sm">See it on The Wall →</a>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold">🧱 You&apos;re launch-ready — put it on The Wall</p>
                  <input value={wTitle} onChange={(e) => setWTitle(e.target.value)} placeholder="Title"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-violet-500" />
                  <input value={wTagline} onChange={(e) => setWTagline(e.target.value)} placeholder="One line — what does it do?"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-violet-500" />
                  <input value={wDemo} onChange={(e) => setWDemo(e.target.value)} placeholder="Demo link (60-sec video or live URL)"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-violet-500" />
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={submitToWall} disabled={submitting || !wTitle.trim() || !wDemo.trim()}
                      className="bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                      {submitting ? "Submitting…" : "Submit to The Wall"}
                    </button>
                    {submitErr && <span className="text-xs text-red-400">{submitErr}</span>}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* When you ship — you own it; the forge recedes */}
      <div className="border border-white/10 rounded-xl p-4">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">When you ship, you own it</p>
        <p className="text-sm text-neutral-400 leading-relaxed">
          It runs on your own infra — code in your GitHub, data in your Supabase. OnlyAIApp doesn&apos;t host or run it; the forge recedes. Come back to build the next one.
        </p>
      </div>
      <div className="border border-dashed border-white/10 rounded-xl p-4 opacity-60">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Later · Groundstream</p>
        <p className="text-sm text-neutral-500 leading-relaxed">
          A future seam to plug your shipped OS into Groundstream&apos;s intelligence layer. Designed for — not available yet.
        </p>
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

      <div className="border border-red-500/20 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-red-400">Danger zone</h3>
        <p className="text-xs text-neutral-500 leading-relaxed">
          Permanently delete this project. This also deletes its Supabase database and Vercel
          deployment — freeing a slot under your Supabase limit. Your GitHub repo is kept (delete it
          on GitHub if you want it gone).
        </p>
        <DeleteProjectButton projectId={project.id} projectName={project.name} redirectTo="/dashboard" variant="button" />
      </div>
    </div>
  );
}
