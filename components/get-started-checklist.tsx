"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

type Step = {
  label: string;
  href: string;
  cta: string;
  done: boolean;
  external?: boolean;
  newTab?: boolean;      // open in a new tab (GitHub-app install) instead of navigating away
  markFlag?: string;     // localStorage key to set when actioned (client-only "done")
};

const VERCEL_APP_KEY = "oaa_vercel_ghapp_installed_v1";
const VERCEL_APP_URL = "https://github.com/apps/vercel/installations/new";

/**
 * First-run guided rail on Home. One linear sequence to a shipped app; the first
 * incomplete step gets the primary CTA. Client component so the Vercel
 * GitHub-app step (which can't be detected server-side) can track that the user
 * actioned it via localStorage.
 */
export function GetStartedChecklist({
  hasGitHub, hasVercel = false, hasSupabase = false, hasProject, hasShipped,
}: {
  hasGitHub: boolean; hasVercel?: boolean; hasSupabase?: boolean; hasProject: boolean; hasShipped: boolean;
}) {
  // The Vercel GitHub-app install isn't detectable server-side — track the click
  // client-side; treat as done once they've shipped (they clearly got past it).
  const [vercelAppClicked, setVercelAppClicked] = useState(false);
  useEffect(() => {
    try { setVercelAppClicked(localStorage.getItem(VERCEL_APP_KEY) === "1"); } catch { /* ignore */ }
  }, []);
  const vercelAppDone = vercelAppClicked || hasShipped;

  const allDone = hasGitHub && hasVercel && hasProject && hasShipped;

  const steps: Step[] = [
    { label: "Connect GitHub", href: "/api/github/connect", cta: "Connect", done: hasGitHub, external: true },
    // Connect your cloud once (one-click OAuth) — then every project auto-provisions.
    { label: "Connect Vercel — so your app auto-deploys live", href: "/api/vercel/oauth", cta: "Connect Vercel", done: hasVercel, external: true },
    // Hidden-but-required: Vercel OAuth grants API access, but Vercel also needs
    // its GitHub app installed (with repo access) to deploy. Without this the
    // first provision fails — so it's a first-class step right after Connect Vercel.
    { label: "Give Vercel access to your repos — install its GitHub app", href: VERCEL_APP_URL, cta: "Install Vercel app", done: vercelAppDone, external: true, newTab: true, markFlag: VERCEL_APP_KEY },
    { label: "Connect Supabase — your app's own database", href: "/api/supabase/oauth", cta: "Connect Supabase", done: hasSupabase, external: true },
    { label: "Pick a track & start building", href: "/tracks", cta: "Pick a track", done: hasProject },
    { label: "Show off your proof", href: "/portfolio", cta: "Open Portfolio", done: hasShipped },
  ];
  const firstTodo = steps.findIndex((s) => !s.done);

  function actioned(step: Step) {
    if (step.markFlag) {
      try { localStorage.setItem(step.markFlag, "1"); } catch { /* ignore */ }
      setVercelAppClicked(true);
    }
  }

  return (
    <div className={`panel p-5 ${!hasGitHub ? "border-l-[3px] border-l-brand" : ""}`}>
      <p className="eyebrow">{allDone ? "🎉 You're rolling" : "🚀 Get started"}</p>
      <h2 className="font-display font-semibold text-on-surface mt-1">{allDone ? "You've shipped — keep building" : "Your setup steps"}</h2>
      {!hasGitHub && (
        <p className="text-sm text-on-surface-variant mt-1">👇 Start here — connect GitHub so your app lives in <i>your</i> account.</p>
      )}
      <ol className="mt-3 space-y-2.5">
        {steps.map((s, i) => {
          const isCurrent = i === firstTodo;
          return (
            <li key={s.label} className={`flex items-center gap-3 rounded-lg ${isCurrent ? "bg-brand-container -mx-2 px-2 py-1.5" : ""}`}>
              <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                s.done ? "bg-success text-white" : isCurrent ? "bg-brand text-white" : "bg-surface-high text-on-surface-variant"
              }`}>
                {s.done ? "✓" : i + 1}
              </span>
              <span className={`text-sm flex-1 ${s.done ? "text-on-surface-variant line-through" : isCurrent ? "text-on-surface font-medium" : "text-on-surface"}`}>{s.label}</span>
              {isCurrent && (
                s.external
                  ? <a
                      href={s.href}
                      target={s.newTab ? "_blank" : undefined}
                      rel={s.newTab ? "noopener noreferrer" : undefined}
                      onClick={() => actioned(s)}
                      className="btn-brand text-sm px-4 py-2 shrink-0"
                    >{s.cta} →</a>
                  : <Link href={s.href} className="btn-brand text-sm px-4 py-2 shrink-0">{s.cta} →</Link>
              )}
            </li>
          );
        })}
      </ol>
      {/* When the Vercel GitHub-app step is current, add the repo-scope hint. */}
      {steps[firstTodo]?.markFlag === VERCEL_APP_KEY && (
        <p className="text-xs text-on-surface-variant mt-3">
          On the GitHub page, pick <b className="text-on-surface">“All repositories”</b> (every project is a fresh repo Vercel needs to reach), then come back — this step checks off on its own.
        </p>
      )}
      {!hasGitHub && (
        <p className="text-xs text-on-surface-variant mt-3">
          No GitHub account?{" "}
          <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer" className="text-brand-dim hover:underline">Create one free →</a>
          {" "}— takes a minute. You only need it when you build your first app.
        </p>
      )}
    </div>
  );
}
