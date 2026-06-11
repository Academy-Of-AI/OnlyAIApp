"use client";

import { useState } from "react";
import type { CheckResult } from "@/lib/pilot/types";

/**
 * The pre-deploy intervention cards. Passes collapse to a quiet green line;
 * warn/fail expand into a card with a plain-English cause and a one remedy:
 * a one-click connect (any tier) or a copy-paste prompt for Claude/Codex (the
 * free DIY path). The in-app auto-fix of prompt remedies is the Pro/Pilot layer.
 */
export function PreflightCards({
  checks, pro, onProceed, busy,
}: {
  checks: CheckResult[];
  pro: boolean;
  onProceed: () => void;
  busy?: boolean;
}) {
  const passes = checks.filter((c) => c.severity === "pass");
  const issues = checks.filter((c) => c.severity === "warn" || c.severity === "fail");
  const skipped = checks.filter((c) => c.severity === "skipped");

  return (
    <div className="panel p-4 space-y-3">
      <p className="text-sm font-medium text-on-surface">Pilot checked your app before going live</p>

      {passes.map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-sm text-on-surface-variant">
          <span className="text-success">✓</span><span>{c.title}</span>
        </div>
      ))}

      {issues.map((c) => <IssueCard key={c.id} c={c} pro={pro} />)}

      {skipped.length > 0 && (
        <p className="text-xs text-outline">Couldn’t check {skipped.length} item{skipped.length === 1 ? "" : "s"} just now — that won’t stop you going live.</p>
      )}

      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <button onClick={onProceed} disabled={busy} className="btn-brand text-sm font-semibold px-4 py-2 disabled:opacity-60">
          {busy ? "Going live…" : issues.length ? "Go live anyway →" : "Go live →"}
        </button>
        {issues.length > 0 && (
          <span className="text-xs text-on-surface-variant">Fix the items above first, or go live now and fix later.</span>
        )}
      </div>
    </div>
  );
}

function IssueCard({ c, pro }: { c: CheckResult; pro: boolean }) {
  const isFail = c.severity === "fail";
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-dim p-3">
      <div className="flex items-center gap-2">
        <span>{isFail ? "⛔" : "⚠️"}</span>
        <span className={`text-sm font-medium ${isFail ? "text-danger" : "text-on-surface"}`}>{c.title}</span>
        <span className="ml-auto text-[11px] text-on-surface-variant">caught it</span>
      </div>
      <p className="text-sm text-on-surface-variant mt-1.5">{c.detail}</p>
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        {c.remedy.kind === "connect" && (
          <a href={c.remedy.href} className="btn-brand text-sm px-3 py-1.5">{c.remedy.label} →</a>
        )}
        {c.remedy.kind === "prompt" && (
          <PromptRemedy label={c.remedy.label} text={c.remedy.prompt} pro={pro} />
        )}
      </div>
    </div>
  );
}

function PromptRemedy({ label, text, pro }: { label: string; text: string; pro: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })
      .catch(() => {});
  }
  return (
    <>
      <button onClick={copy} className="btn-ghost text-sm px-3 py-1.5">
        {copied ? "Copied ✓" : `📋 ${label}`}
      </button>
      <span className="text-xs text-on-surface-variant">
        {pro
          ? "One-click auto-fix is rolling out for Pro — for now, paste this into Claude or Codex."
          : "Paste it into Claude or Codex and it’ll fix this for you."}
      </span>
    </>
  );
}
