"use client";

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

      {tab === "Build"    && <BuildTab project={project} />}
      {tab === "Analytics" && <ComingSoonTab title="Analytics" desc="Once your app has real users, their activity will appear here — signups, active users, activation funnel, and revenue." icon="📊" />}
      {tab === "CRM"      && <ComingSoonTab title="CRM" desc="Every user who signs up to your app will appear here. See who they are, what they've done, and send them emails directly." icon="👥" />}
      {tab === "Settings" && <SettingsTab project={project} />}
    </div>
  );
}

/* ── Build tab ─────────────────────────────────────────────── */
function BuildTab({ project }: { project: Project }) {
  const [prompt, setPrompt]     = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setSubmitting(true);
    // Save prompt against the project for Module 2 to pick up
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ build_prompt: prompt.trim() }),
    });
    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Build your app</h2>
        <p className="text-sm text-neutral-400">
          Describe what you want to add or change — we&apos;ll build it for you.
        </p>
      </div>

      {submitted ? (
        <div className="border border-green-500/25 bg-green-500/5 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center text-green-400 text-sm">✓</div>
            <div>
              <p className="font-semibold text-sm text-green-400">Got it — your idea is saved</p>
              <p className="text-xs text-neutral-500 mt-0.5">We&apos;ll build it when Module 2 launches. You&apos;ll be first in line.</p>
            </div>
          </div>
          <div className="bg-white/[0.03] rounded-lg px-4 py-3 text-sm text-neutral-400 italic border border-white/[0.06]">
            &ldquo;{prompt}&rdquo;
          </div>
          <button
            onClick={() => { setSubmitted(false); setPrompt(""); }}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors underline underline-offset-2"
          >
            Submit a different idea
          </button>
        </div>
      ) : (
        <div className="border border-white/10 rounded-xl overflow-hidden focus-within:border-green-500/40 focus-within:ring-1 focus-within:ring-green-500/20 transition-all">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-neutral-500 p-4 resize-none min-h-[110px] outline-none"
            placeholder="e.g. Build a corporate training app with a learning roadmap, course catalogue, and booking flow…"
          />
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10">
            <span className="text-xs text-neutral-600">Describe what you want built</span>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || submitting}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-bold px-4 py-1.5 rounded-lg transition-colors"
            >
              {submitting ? "Saving…" : "✦ Generate"}
            </button>
          </div>
        </div>
      )}

      {!submitted && (
        <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">How it works</p>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Describe your idea and we handle everything — figuring out what your app needs,
            building every page, and deploying it live automatically.
            No code. No setup. Just describe and ship.
          </p>
        </div>
      )}

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

/* ── Coming soon placeholder ───────────────────────────────── */
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

/* ── Settings tab ──────────────────────────────────────────── */
function SettingsTab({ project }: { project: Project }) {
  const [name, setName]         = useState(project.name);
  const [url, setUrl]           = useState(project.vercel_preview_url ?? "");
  const [editingName, setEditingName] = useState(false);
  const [editingUrl, setEditingUrl]   = useState(false);
  const [saving, setSaving]     = useState<"name" | "url" | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [saved, setSaved]       = useState<"name" | "url" | null>(null);

  async function save(field: "name" | "url") {
    setError(null);
    setSaving(field);
    const body = field === "name"
      ? { name }
      : { vercel_preview_url: url };

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
                    onKeyDown={(e) => { if (e.key === "Enter") save("name"); if (e.key === "Escape") { setName(project.name); setEditingName(false); } }}
                  />
                  <button onClick={() => save("name")} disabled={saving === "name"}
                    className="text-xs bg-green-500 hover:bg-green-400 text-black font-semibold px-2.5 py-1 rounded-md transition-colors disabled:opacity-50">
                    {saving === "name" ? "…" : "Save"}
                  </button>
                  <button onClick={() => { setName(project.name); setEditingName(false); }}
                    className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Cancel</button>
                </>
              ) : (
                <>
                  <span className="text-neutral-300 truncate">{name}</span>
                  {saved === "name" && <span className="text-xs text-green-400">Saved ✓</span>}
                  <button onClick={() => setEditingName(true)}
                    className="text-neutral-600 hover:text-neutral-300 text-xs transition-colors ml-1" title="Edit">✎</button>
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
                    onKeyDown={(e) => { if (e.key === "Enter") save("url"); if (e.key === "Escape") { setUrl(project.vercel_preview_url ?? ""); setEditingUrl(false); } }}
                  />
                  <button onClick={() => save("url")} disabled={saving === "url"}
                    className="text-xs bg-green-500 hover:bg-green-400 text-black font-semibold px-2.5 py-1 rounded-md transition-colors disabled:opacity-50">
                    {saving === "url" ? "…" : "Save"}
                  </button>
                  <button onClick={() => { setUrl(project.vercel_preview_url ?? ""); setEditingUrl(false); }}
                    className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">Cancel</button>
                </>
              ) : (
                <>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 truncate transition-colors">{url}</a>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                  {saved === "url" && <span className="text-xs text-green-400">Saved ✓</span>}
                  <button onClick={() => setEditingUrl(true)}
                    className="text-neutral-600 hover:text-neutral-300 text-xs transition-colors ml-1" title="Edit">✎</button>
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
                  <a href={href} target="_blank" rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300 truncate transition-colors">{value}</a>
                ) : (
                  <span className="text-neutral-300 truncate">{value ?? "—"}</span>
                )}
                {copy && value && (
                  <button onClick={() => copyToClipboard(value)}
                    className="text-neutral-600 hover:text-neutral-400 text-xs shrink-0 transition-colors" title="Copy">⎘</button>
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
        <a href="/dashboard" className="inline-block text-sm text-green-400 hover:text-green-300 transition-colors">
          ← Back to dashboard &amp; connections
        </a>
      </div>
    </div>
  );
}
