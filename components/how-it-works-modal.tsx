"use client";

import { useEffect, useState } from "react";
import { HOW_IT_WORKS_STEPS as STEPS } from "@/lib/how-it-works";

/**
 * First-login orientation modal. Shows ONCE per browser (localStorage-gated) so a
 * brand-new builder immediately understands the journey and where to start —
 * instead of landing on a dashboard and hunting for the "Connect" button.
 * Re-openable any time via the "How it works" control in the sidebar/help.
 */
const SEEN_KEY = "oaa_how_it_works_v1";

export function HowItWorksModal({ hasGitHub }: { hasGitHub: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      // Auto-show once per browser; ?tour=1 force-reopens it (the "How it works" link).
      const forced = typeof window !== "undefined" && window.location.search.includes("tour=1");
      if (forced || !localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch { /* private mode — just don't show */ }
  }, []);

  function dismiss() {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How OnlyAIApp works"
      onClick={dismiss}
    >
      <div
        className="panel w-full max-w-lg p-6 sm:p-7 relative max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-lg text-on-surface-variant hover:bg-surface-high"
        >✕</button>

        <p className="eyebrow">👋 Welcome to OnlyAIApp</p>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-on-surface mt-1">
          How it works — idea to a real app you own
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">Four steps. No setup headaches, no toy demos.</p>

        <ol className="mt-5 space-y-3.5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3.5">
              <span className="w-9 h-9 rounded-xl bg-brand-container text-brand-dim grid place-items-center text-lg shrink-0">{s.icon}</span>
              <div className="min-w-0">
                <p className="font-display font-semibold text-on-surface text-sm">
                  <span className="text-on-surface-variant font-mono text-xs mr-1.5">{i + 1}</span>{s.title}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
          {hasGitHub ? (
            <button onClick={dismiss} className="btn-brand text-sm px-5 py-2.5 w-full sm:w-auto">Let’s build →</button>
          ) : (
            <>
              <a href="/api/github/connect" className="btn-brand text-sm px-5 py-2.5 w-full sm:w-auto text-center">
                Connect GitHub to start →
              </a>
              <button onClick={dismiss} className="btn-ghost text-sm px-5 py-2.5 w-full sm:w-auto">I’ll explore first</button>
            </>
          )}
        </div>
        {!hasGitHub && (
          <p className="text-[11px] text-outline mt-2.5">
            GitHub is where your app lives — it stays in <i>your</i> account, not ours. No GitHub yet?{" "}
            <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer" className="text-brand-dim hover:underline">Create one free</a> (takes a minute).
          </p>
        )}
      </div>
    </div>
  );
}
