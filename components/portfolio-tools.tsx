"use client";

import { useState } from "react";

const ARTIFACTS = [
  { type: "case_study", icon: "📄", title: "Case study", sub: "1-page story of what you built" },
  { type: "linkedin", icon: "💼", title: "LinkedIn post", sub: "Ready-to-publish announcement" },
  { type: "resume", icon: "📝", title: "Résumé lines", sub: "Bullet points for your CV" },
] as const;

type ArtifactType = (typeof ARTIFACTS)[number]["type"];

const SITE = "onlyaiapp.com"; // baked into every artifact → free publicity when shared

/** Deterministic templates (no AI, no tokens). User edits the [bracketed] bits. */
function buildArtifact(type: ArtifactType, appName: string): string {
  if (type === "linkedin") {
    return `🚀 I just shipped ${appName} — a real, working app I built with AI.\n\n` +
      `Not a prototype: it's live, it's mine, and it works end-to-end.\n\n` +
      `Built it with ${SITE} — it set up the repo, database & hosting so I could focus on building. ` +
      `If you've been meaning to ship something, give it a look.\n\n` +
      `#buildinpublic #AI #shipit`;
  }
  if (type === "resume") {
    return `• Designed & shipped ${appName}, a production web app (Next.js, Supabase), solo — built with AI via ${SITE}.\n` +
      `• Took it end-to-end: data model, core features, and live deployment.`;
  }
  // case_study
  return `Case study — ${appName}\n\n` +
    `Problem: [the painful, repetitive thing it solves]\n` +
    `What I built: ${appName} — a live web app. [one line on what it does]\n` +
    `How: built with AI on a solid foundation via ${SITE} (real repo, database & hosting — I own all of it).\n` +
    `Outcome: deployed and working end-to-end.\n` +
    `What it shows: I can take an idea and ship a real, working product.\n\n` +
    `Built with ${SITE}`;
}

export function ArtifactStudio({ apps = [] }: { apps?: { id: string; name: string }[] }) {
  const [active, setActive] = useState<ArtifactType | null>(null);
  const [appId, setAppId] = useState<string>(apps.length === 1 ? apps[0].id : "");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const selected = apps.find((a) => a.id === appId);
  const appName = selected?.name ?? apps[0]?.name ?? "my app";

  function generate(type: ArtifactType) {
    setActive(type);
    setText(buildArtifact(type, appName));
    setCopied(false);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ }
  }

  return (
    <div className="space-y-3">
      {apps.length > 1 && (
        <div>
          <label className="text-xs text-on-surface-variant">Write about</label>
          <select value={appId} onChange={(e) => { setAppId(e.target.value); if (active) setText(buildArtifact(active, apps.find((a) => a.id === e.target.value)?.name ?? appName)); }}
            className="cap-input mt-1">
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {ARTIFACTS.map((a) => (
          <button key={a.type} onClick={() => generate(a.type)}
            className={`text-left rounded-lg border p-3 transition-colors ${
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

      {text && (
        <div className="panel p-4 space-y-2.5">
          <textarea readOnly value={text} rows={Math.min(16, text.split("\n").length + 2)}
            className="cap-input resize-none font-data text-sm leading-relaxed" />
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={copy} className="btn-brand text-sm px-4 py-2">{copied ? "✓ Copied" : "📋 Copy"}</button>
            <span className="text-[11px] text-on-surface-variant">Tweak the [bracketed] bits before you post — and the {SITE} link stays in for the win 😉</span>
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
