"use client";

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

const TABS = ["Build", "Analytics", "CRM", "Settings"] as const;
type Tab = (typeof TABS)[number];

export function ProjectTabs({ project }: { project: Project }) {
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

      {tab === "Build"     && <BuildTab project={project} />}
      {tab === "Analytics" && <ComingSoonTab title="Analytics" desc="Once your app has real users, their activity will appear here — signups, active users, activation funnel, and revenue." icon="📊" />}
      {tab === "CRM"       && <ComingSoonTab title="CRM" desc="Every user who signs up to your app will appear here. See who they are, what they've done, and send them emails directly." icon="👥" />}
      {tab === "Settings"  && <SettingsTab project={project} />}
    </div>
  );
}

/* ── Types ──────────────────────────────────────────────────────────────── */
type StepStatus = "pending" | "running" | "done" | "error";

interface BuildStep {
  label: string;
  status: StepStatus;
}

const INITIAL_STEPS: BuildStep[] = [
  { label: "Reading your app's code",  status: "pending" },
  { label: "Generating your changes",  status: "pending" },
  { label: "Pushing to GitHub",        status: "pending" },
  { label: "Going live on Vercel",     status: "pending" },
];

/* ── Build tab ─────────────────────────────────────────────────────────── */
function BuildTab({ project }: { project: Project }) {
  const router = useRouter();
  const [prompt, setPrompt]       = useState(project.build_prompt ?? "");
  const [phase, setPhase]         = useState<"idle" | "building" | "done" | "error">("idle");
  const [steps, setSteps]         = useState<BuildStep[]>(INITIAL_STEPS);
  const [commitMsg, setCommitMsg] = useState("");
  const [errorMsg, setErrorMsg]   = useState("");

  function setStep(index: number, status: StepStatus) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status } : s)),
    );
  }

  function markUpTo(upToIndex: number, status: StepStatus) {
    setSteps((prev) =>
      prev.map((s, i) => (i <= upToIndex ? { ...s, status } : s)),
    );
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;

    setPhase("building");
    setErrorMsg("");
    setCommitMsg("");
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "pending" })));

    /* 1. Save the prompt */
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ build_prompt: prompt.trim() }),
    });

    /* 2. Trigger build (SSE) */
    let res: Response;
    try {
      res = await fetch(`/api/projects/${project.id}/build`, { method: "POST" });
    } catch {
      setErrorMsg("Network error — please try again.");
      setPhase("error");
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Build failed" }));
      setErrorMsg(data.error ?? "Build failed");
      setPhase("error");
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      setErrorMsg("Stream unavailable — please try again.");
      setPhase("error");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          switch (event.step) {
            case "reading":
              setStep(0, "running");
              break;
            case "generating":
              setStep(0, "done");
              setStep(1, "running");
              break;
            case "pushing":
              markUpTo(1, "done");
              setStep(2, "running");
              break;
            case "deploying":
              markUpTo(2, "done");
              setStep(3, "running");
              break;
            case "done":
              setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
              setCommitMsg(event.commitMessage ?? "");
              setPhase("done");
              router.refresh();
              break;
            case "error":
              setErrorMsg(event.message ?? "Build failed");
              setPhase("error");
              break;
          }
        } catch {
          /* skip malformed SSE line */
        }
      }
    }
  }

  /* ── Idle / input ────────────────────────────────────────────────────── */
  if (phase === "idle") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-lg font-semibold mb-1">Build your app</h2>
          <p className="text-sm text-neutral-400">
            Describe what you want to add or change — we&apos;ll build it for you.
          </p>
        </div>

        <div className="border border-white/10 rounded-xl overflow-hidden focus-within:border-green-500/40 focus-within:ring-1 focus-within:ring-green-500/20 transition-all">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-neutral-500 p-4 resize-none min-h-[110px] outline-none"
            placeholder="e.g. Add a pricing page with three tiers — Starter, Pro, and Enterprise…"
          />
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10">
            <span className="text-xs text-neutral-600">Describe what you want built</span>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
            >
              ✦ Generate
            </button>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">How it works</p>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Describe your idea and we handle everything — reading your existing code,
            figuring out what needs to change, and deploying it live automatically.
            No code. No setup. Just describe and ship.
          </p>
        </div>

        {project.vercel_preview_url && (
          <div className="flex gap-3">
            <a
              href={project.vercel_preview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              ↗ Open live app
            </a>
            {project.github_repo_url && (
              <a
                href={project.github_repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-white/10 hover:border-white/20 text-sm text-neutral-300 px-4 py-2 rounded-lg transition-colors"
              >
                GitHub repo →
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── Building ────────────────────────────────────────────────────────── */
  if (phase === "building") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-lg font-semibold mb-1">Building your app…</h2>
          <p className="text-sm text-neutral-400">This usually takes 1–2 minutes. Don&apos;t close the page.</p>
        </div>

        <div className="border border-white/10 rounded-xl p-6 space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-neutral-400 italic">
            &ldquo;{prompt}&rdquo;
          </div>

          <div className="space-y-3 pt-1">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <StepIcon status={step.status} />
                <span className={`text-sm ${step.status === "running" ? "text-white" : step.status === "done" ? "text-green-400" : "text-neutral-500"}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Done ────────────────────────────────────────────────────────────── */
  if (phase === "done") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="border border-green-500/25 bg-green-500/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center text-green-400">✓</div>
            <div>
              <p className="font-semibold text-sm text-green-400">Your changes are deploying!</p>
              <p className="text-xs text-neutral-500 mt-0.5">Vercel is building your updated app — it&apos;ll be live in about 60 seconds.</p>
            </div>
          </div>

          {commitMsg && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-neutral-400">
              <span className="text-neutral-600 text-xs mr-2">committed:</span>{commitMsg}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            {project.vercel_preview_url && (
              <a
                href={project.vercel_preview_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-4 py-2 rounded-lg transition-colors"
              >
                ↗ Open live app
              </a>
            )}
            <button
              onClick={() => { setPhase("idle"); setPrompt(""); }}
              className="border border-white/10 hover:border-white/20 text-sm text-neutral-300 px-4 py-2 rounded-lg transition-colors"
            >
              Build something else
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border border-red-500/25 bg-red-500/5 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center text-red-400 text-sm">✕</div>
          <div>
            <p className="font-semibold text-sm text-red-400">Build failed</p>
            <p className="text-xs text-neutral-500 mt-0.5">{errorMsg}</p>
          </div>
        </div>
        <button
          onClick={() => setPhase("idle")}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/* ── Step icon ──────────────────────────────────────────────────────────── */
function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return <span className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs shrink-0">✓</span>;
  if (status === "running")
    return <span className="w-5 h-5 rounded-full border border-green-500/50 flex items-center justify-center shrink-0 animate-spin text-green-400 text-xs">⟳</span>;
  if (status === "error")
    return <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs shrink-0">✕</span>;
  return <span className="w-5 h-5 rounded-full border border-white/15 shrink-0" />;
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
