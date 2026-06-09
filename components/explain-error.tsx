"use client";

import { useEffect, useState } from "react";

interface ExplainResult {
  ok: boolean;
  broken?: boolean;
  whatBroke?: string;
  nextStep?: string;
  fixPrompt?: string;
  errorLine?: string | null;
}

/**
 * <ExplainError projectId /> — the signature Pilot Lite card.
 * On mount it asks the API whether this project's latest deploy failed; if so it
 * shows a CALM, plain-English diagnosis: what went wrong, your ONE next step, and
 * a paste-ready prompt to hand your coding agent. Free users get this too.
 */
export function ExplainError({ projectId }: { projectId: string }) {
  const [state, setState] = useState<"loading" | "ok" | "broken" | "clear" | "error">("loading");
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setState("loading");
    setCopied(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/explain-error`, { cache: "no-store" });
      const data = (await res.json()) as ExplainResult & { error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not check your deploy");
      if (data.broken && data.whatBroke) {
        setResult(data);
        setState("broken");
      } else {
        setState("clear");
      }
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function copyFix() {
    if (!result?.fixPrompt) return;
    try {
      await navigator.clipboard.writeText(result.fixPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the box stays selectable for manual copy */
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="panel p-5 text-sm text-on-surface-variant flex items-center gap-2">
        <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-outline border-t-transparent animate-spin" />
        Checking your latest deploy…
      </div>
    );
  }

  // ── Couldn't check (network / API) — soft, never alarming ───────────────────
  if (state === "error") {
    return (
      <div className="panel p-5 text-sm text-on-surface-variant flex items-center justify-between gap-3">
        <span>Couldn&apos;t check your deploy just now.</span>
        <button
          onClick={load}
          className="btn-ghost text-xs px-3 py-1.5 transition-colors active:scale-95 shrink-0"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── All clear — latest deploy is fine ───────────────────────────────────────
  if (state === "clear") {
    return (
      <div className="rounded-xl p-5 border border-[rgba(15,138,62,0.3)] bg-[rgba(21,164,75,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-success">✓ Your latest deploy is healthy</p>
          <button
            onClick={load}
            className="text-xs text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
          >
            Re-check
          </button>
        </div>
        <p className="text-xs text-on-surface-variant mt-1.5">
          No build errors right now. If a deploy fails, this is where your one next step will appear.
        </p>
      </div>
    );
  }

  // ── Broken — the main event: diagnosis + one step + paste-to-fix ────────────
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.06)] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-danger flex items-center gap-2">🔴 Your last deploy failed</p>
            <p className="text-xs text-on-surface-variant mt-0.5">Don&apos;t worry — you can fix this in one step.</p>
          </div>
          <button
            onClick={load}
            className="text-xs text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
          >
            Re-check
          </button>
        </div>

        {/* What went wrong */}
        <div>
          <p className="text-xs uppercase tracking-wide text-on-surface-variant mb-1 font-medium">What went wrong</p>
          <p className="text-sm text-on-surface leading-relaxed">{result?.whatBroke}</p>
        </div>

        {/* Your one next step */}
        <div className="border-l-2 border-brand bg-brand-container rounded-r-lg px-4 py-3">
          <p className="text-xs text-brand-dim mb-1 font-medium">Your one next step</p>
          <p className="text-sm text-on-surface font-medium">{result?.nextStep}</p>
        </div>

        {/* Paste this to your agent to fix it */}
        {result?.fixPrompt && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-on-surface-variant">Paste this to your agent to fix it</p>
              <button
                type="button"
                onClick={copyFix}
                className="text-xs px-2.5 py-1 rounded-md border border-outline text-on-surface-variant hover:text-on-surface hover:border-on-surface-variant transition-colors active:scale-95"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <textarea
              readOnly
              value={result.fixPrompt}
              onFocus={(e) => e.currentTarget.select()}
              rows={4}
              className="w-full resize-none rounded-lg bg-surface-high border border-outline px-3 py-2 text-xs font-mono text-on-surface leading-relaxed focus:outline-none focus:border-brand"
            />
            <p className="text-[11px] text-outline mt-1.5">
              Paste it into Claude Code or Codex, let it fix &amp; push — then hit Re-check.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
