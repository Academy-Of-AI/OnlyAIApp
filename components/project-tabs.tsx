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
          className="w-full bg-transparent text-sm text-white placeholder-neutral-500 p-4 resize-none min-h-[110px] outline-none"
          placeholder="e.g. Add a dashboard page that shows total signups and revenue this month…"
        />
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10">
          <span className="text-xs text-neutral-600">Describe a feature, page, or change</span>
          <button
            className="bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-4 py-1.5 rounded-lg transition-colors opacity-50 cursor-not-allowed"
            disabled
            title="Coming in Module 2"
          >
            ✦ Generate
          </button>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-5">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Module 2 — coming soon</p>
        <p className="text-sm text-neutral-400 leading-relaxed">
          Prompt your idea above and we&apos;ll handle the whole thing: figuring out what your app needs,
          building every page, and deploying it live — all automatically.
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
  const rows: { label: string; value: string | null; href?: string; copy?: boolean }[] = [
    { label: "Project name",     value: project.name },
    { label: "Status",           value: project.status },
    { label: "Template",         value: project.template_id },
    { label: "Created",          value: new Date(project.created_at).toLocaleString() },
    { label: "Deployed",         value: project.deployed_at ? new Date(project.deployed_at).toLocaleString() : "—" },
    { label: "Live URL",         value: project.vercel_preview_url, href: project.vercel_preview_url ?? undefined },
    { label: "GitHub repo",      value: project.github_repo_url,    href: project.github_repo_url ?? undefined },
    { label: "Supabase ref",     value: project.supabase_project_ref, copy: true },
    { label: "Vercel project",   value: project.vercel_project_id },
  ];

  function copyToClipboard(value: string) {
    navigator.clipboard.writeText(value);
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-4">Project details</h2>
        <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/[0.06]">
          {rows.map(({ label, value, href, copy }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-neutral-500 w-36 shrink-0">{label}</span>
              <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                {href && value ? (
                  <a href={href} target="_blank" rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300 truncate transition-colors">
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
