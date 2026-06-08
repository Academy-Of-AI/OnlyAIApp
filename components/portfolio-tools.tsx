"use client";

import { useState } from "react";
import Link from "next/link";

const ARTIFACTS = [
  { type: "case_study", icon: "📄", title: "Case study", sub: "1-page story of what you built" },
  { type: "linkedin", icon: "💼", title: "LinkedIn post", sub: "Ready-to-publish announcement" },
  { type: "resume", icon: "📝", title: "Résumé lines", sub: "Bullet points for your CV" },
] as const;

type ArtifactType = (typeof ARTIFACTS)[number]["type"];

const SITE = "onlyaiapp.com"; // baked into every artifact → free publicity when shared

type App = { id: string; name: string; summary?: string; problem?: string };

/** Deterministic templates (no AI, no tokens). Auto-filled from the app's plan;
 *  any gaps stay as [brackets] for the user to tweak. */
function buildArtifact(type: ArtifactType, app: App): string {
  const name = app.name;
  const summary = app.summary?.trim();
  const problem = app.problem?.trim();
  if (type === "linkedin") {
    return `🚀 I just shipped ${name}${summary ? ` — ${summary}` : " — a real, working app I built with AI"}.\n\n` +
      `Not a prototype: it's live, it's mine, and it works end-to-end.\n\n` +
      `Built it with ${SITE} — it set up the repo, database & hosting so I could focus on building. ` +
      `If you've been meaning to ship something, give it a look.\n\n` +
      `#buildinpublic #AI #shipit`;
  }
  if (type === "resume") {
    return `• Designed & shipped ${name}${summary ? ` (${summary})` : ""}, a production web app (Next.js, Supabase), solo — built with AI via ${SITE}.\n` +
      `• Took it end-to-end: data model, core features, and live deployment.`;
  }
  // case_study
  return `Case study — ${name}\n\n` +
    `Problem: ${problem || "[the painful, repetitive thing it solves]"}\n` +
    `What I built: ${name} — ${summary || "a live web app. [one line on what it does]"}\n` +
    `How: built with AI on a solid foundation via ${SITE} (real repo, database & hosting — I own all of it).\n` +
    `Outcome: deployed and working end-to-end.\n` +
    `What it shows: I can take an idea and ship a real, working product.\n\n` +
    `Built with ${SITE}`;
}

export function ArtifactStudio({ apps = [], remaining = null }: { apps?: App[]; remaining?: number | null }) {
  const [active, setActive] = useState<ArtifactType | null>(null);
  const [appId, setAppId] = useState<string>(apps[0]?.id ?? "");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiLeft, setAiLeft] = useState<number | null>(remaining);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ err?: boolean; text: string } | null>(null);

  const selectedApp = apps.find((a) => a.id === appId) ?? apps[0];

  function generate(type: ArtifactType) {
    setActive(type);
    if (selectedApp) setText(buildArtifact(type, selectedApp));
    setCopied(false); setAiMsg(null);
  }

  async function improveWithAI() {
    if (!active || !selectedApp || aiBusy) return;
    if (aiLeft !== null && aiLeft <= 0) return;
    setAiBusy(true); setAiMsg(null);
    try {
      const res = await fetch("/api/portfolio/artifact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: active, projectId: selectedApp.id }),
      });
      const d = await res.json();
      if (!res.ok) setAiMsg({ err: true, text: d.error ?? "Couldn't write — try again." });
      else { setText(d.text); setAiLeft(d.remaining); setCopied(false); }
    } catch {
      setAiMsg({ err: true, text: "Network error — try again." });
    } finally {
      setAiBusy(false);
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
          <select value={appId} onChange={(e) => { const id = e.target.value; setAppId(id); const a = apps.find((x) => x.id === id); if (active && a) setText(buildArtifact(active, a)); }}
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
            {(aiLeft === null || aiLeft > 0)
              ? <button onClick={improveWithAI} disabled={aiBusy} className="btn-ghost text-sm px-4 py-2">{aiBusy ? "✨ Writing…" : `✨ Write it with AI${aiLeft === null ? "" : ` · ${aiLeft} left`}`}</button>
              : <Link href="/upgrade" className="btn-ghost text-sm px-4 py-2">✨ Out of AI writes — upgrade</Link>}
            {aiMsg && <span className={`text-[11px] ${aiMsg.err ? "text-danger" : "text-success"}`}>{aiMsg.text}</span>}
          </div>
          <p className="text-[11px] text-on-surface-variant">Instant template above — or let AI rewrite it better. Tweak the [bracketed] bits; the {SITE} link stays in for the win 😉</p>
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
