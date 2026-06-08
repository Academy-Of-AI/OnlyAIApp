"use client";

import { useState } from "react";

const ARTIFACTS = [
  { type: "case_study", icon: "📄", title: "Case study", sub: "1-page story of what you built" },
  { type: "linkedin", icon: "💼", title: "LinkedIn post", sub: "Ready-to-publish announcement" },
  { type: "resume", icon: "📝", title: "Résumé lines", sub: "Bullet points for your CV" },
] as const;

type ArtifactType = (typeof ARTIFACTS)[number]["type"];

export function ArtifactStudio({ apps = [] }: { apps?: { id: string; name: string }[] }) {
  const [active, setActive] = useState<ArtifactType | null>(null);
  const [appId, setAppId] = useState<string>(apps.length === 1 ? apps[0].id : "");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate(type: ArtifactType) {
    setActive(type); setBusy(true); setError(""); setText(""); setCopied(false);
    try {
      const res = await fetch("/api/portfolio/artifact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, projectId: appId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Couldn’t generate — try again.");
      else setText(data.text ?? "");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ }
  }

  return (
    <div className="space-y-3">
      {apps.length > 1 && (
        <div>
          <label className="text-xs text-on-surface-variant">Write about</label>
          <select value={appId} onChange={(e) => setAppId(e.target.value)} className="cap-input mt-1">
            <option value="">All my apps</option>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {ARTIFACTS.map((a) => (
          <button key={a.type} onClick={() => generate(a.type)} disabled={busy}
            className={`text-left rounded-lg border p-3 transition-colors disabled:opacity-60 ${
              active === a.type ? "border-brand-border bg-brand-container" : "border-outline-variant bg-surface-low hover:border-outline"
            }`}>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg grid place-items-center bg-brand-container text-base shrink-0">{a.icon}</span>
              <span className="text-sm font-medium text-on-surface">{a.title}</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1.5">{a.sub}</p>
          </button>
        ))}
      </div>

      {busy && <p className="text-sm text-on-surface-variant">✍️ Writing your {ARTIFACTS.find((a) => a.type === active)?.title.toLowerCase()}…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {text && !busy && (
        <div className="panel p-4 space-y-2.5">
          <textarea readOnly value={text} rows={Math.min(16, text.split("\n").length + 3)}
            className="cap-input resize-none font-data text-sm leading-relaxed" />
          <div className="flex gap-2">
            <button onClick={copy} className="btn-brand text-sm px-4 py-2">{copied ? "✓ Copied" : "📋 Copy"}</button>
            <button onClick={() => active && generate(active)} className="btn-ghost text-sm px-4 py-2">↻ Regenerate</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CopyLinkButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://onlyaiapp.com/u/${username}`;
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ }
  }
  return (
    <button onClick={copy} className="btn-ghost text-sm px-3 py-1.5">{copied ? "✓ Copied" : "🔗 Copy public link"}</button>
  );
}
