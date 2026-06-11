"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Step = {
  label: string;
  href: string;
  cta: string;
  done: boolean;
  external?: boolean;
  newTab?: boolean;        // open in a new tab (GitHub-app install) instead of navigating away
  isVercelApp?: boolean;   // the Vercel GitHub-app step — VERIFIED server-side, not click-tracked
};

// Remembers the user opened the install page — used ONLY to tailor the hint copy
// ("we can't see it yet"), never to claim the step is done. The truth comes from
// the server (Vercel git-namespaces); a click just opens a page.
const VERCEL_APP_KEY = "oaa_vercel_ghapp_opened_v1";
const VERCEL_APP_URL = "https://github.com/apps/vercel/installations/new";

type VercelAppStatus = { connected: boolean; installed: boolean; requireReauth: boolean };

/**
 * First-run guided rail on Home. One linear sequence to a shipped app; the first
 * incomplete step gets the primary CTA.
 *
 * The Vercel GitHub-app step used to check itself off the instant the user
 * CLICKED "Install" — a click that only opens a page, so it lied (the step went
 * green even when the app wasn't actually installed, and the next provision
 * failed with "install the GitHub integration first"). It now reflects the REAL
 * state from GET /api/vercel/github-app (Vercel git-namespaces), re-checking when
 * the user returns from the install tab.
 */
export function GetStartedChecklist({
  hasGitHub, hasVercel = false, hasSupabase = false, hasProject,
  hasPlan = false, hasMemory = false, hasShipped, projectId = null, isPro,
}: {
  hasGitHub: boolean; hasVercel?: boolean; hasSupabase?: boolean; hasProject: boolean;
  hasPlan?: boolean; hasMemory?: boolean; hasShipped: boolean; projectId?: string | null;
  /** AI plan generation is Pro-gated — when false, the objective step routes to Upgrade. */
  isPro?: boolean;
}) {
  const [appStatus, setAppStatus] = useState<VercelAppStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [openedInstall, setOpenedInstall] = useState(false);

  const checkVercelApp = useCallback(async () => {
    // Only meaningful once Vercel is connected; a shipped user has obviously
    // already cleared this, so skip the call.
    if (!hasVercel || hasShipped) return;
    setChecking(true);
    try {
      const r = await fetch("/api/vercel/github-app", { cache: "no-store" });
      if (r.ok) setAppStatus((await r.json()) as VercelAppStatus);
    } catch {
      /* keep prior status — failing the check must never hard-block the flow */
    } finally {
      setChecking(false);
    }
  }, [hasVercel, hasShipped]);

  useEffect(() => {
    try { setOpenedInstall(localStorage.getItem(VERCEL_APP_KEY) === "1"); } catch { /* ignore */ }
  }, []);
  useEffect(() => { void checkVercelApp(); }, [checkVercelApp]);
  // Re-check when the user tabs back from the GitHub install page (so the step
  // flips to ✓ on its own moments after they finish installing).
  useEffect(() => {
    const onFocus = () => { if (!appStatus?.installed) void checkVercelApp(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [appStatus, checkVercelApp]);

  const vercelAppVerified = !!appStatus?.installed && !appStatus.requireReauth;
  const vercelAppDone = hasShipped || vercelAppVerified;

  const allDone = hasShipped;

  // ONE shared end-to-end journey, rendered identically on Home AND /projects (so
  // the two can never tell conflicting stories). Setup steps first, then the
  // per-project build loop. `pid` (the active/first project) powers the build-loop
  // links; before a project exists they point at /tracks and read as "future".
  const pid = projectId;
  const objectiveGated = isPro === false; // free users can't generate an AI plan
  const steps: Step[] = [
    { label: "Connect GitHub", href: "/api/github/connect", cta: "Connect", done: hasGitHub, external: true },
    // Connect your cloud once (one-click OAuth) — then every project auto-provisions.
    { label: "Connect Vercel — so your app auto-deploys live", href: "/api/vercel/oauth", cta: "Connect Vercel", done: hasVercel, external: true },
    // Hidden-but-required: Vercel OAuth grants API access, but Vercel also needs
    // its GitHub app installed (with repo access) to deploy. Verified, not guessed.
    { label: "Give Vercel access to your repos — install its GitHub app", href: VERCEL_APP_URL, cta: "Install Vercel app", done: vercelAppDone, external: true, newTab: true, isVercelApp: true },
    { label: "Connect Supabase — your app's own database", href: "/api/supabase/oauth", cta: "Connect Supabase", done: hasSupabase, external: true },
    { label: "Start your first build — pick a track", href: "/tracks", cta: "Pick a track", done: hasProject },
    objectiveGated
      ? { label: "Set your objective (AI plan — a Pro feature)", href: "/upgrade", cta: "Upgrade", done: hasPlan }
      : { label: "Set your objective — the plan your agent follows", href: pid ? `/projects/${pid}/plan` : "/tracks", cta: "Set objective", done: hasPlan },
    { label: "Build it with your AI agent", href: pid ? `/projects/${pid}` : "/tracks", cta: "Open build", done: hasMemory },
    { label: "Ship it live — a real app you own", href: pid ? `/projects/${pid}` : "/tracks", cta: "Open build", done: hasShipped },
  ];
  // The Vercel GitHub-app install can't be confirmed BEFORE the first build (our
  // integration token can't read Vercel's git connection — see /api/vercel/github-app).
  // So once the user has ACTIONED the install, the step stops blocking the flow:
  // it shows an honest amber "set up · confirms on your first build" — NOT a green
  // ✓ (no false claim) and NOT a stuck ○ (no dead-end) — and the next step becomes
  // current. It only turns true-green when actually confirmed (a re-check that
  // succeeds, or the first build's DB proof).
  const vercelAppPending = openedInstall && !vercelAppDone;
  const firstTodo = steps.findIndex((s) => !s.done && !(s.isVercelApp && vercelAppPending));
  const currentStep = steps[firstTodo];

  function openedVercelInstall() {
    try { localStorage.setItem(VERCEL_APP_KEY, "1"); } catch { /* ignore */ }
    setOpenedInstall(true);
  }

  // Vercel-app step is current but its real status hasn't resolved yet — show a
  // neutral "Checking…" instead of flashing an Install CTA at someone who may
  // already have it installed.
  const vercelAppChecking = !!currentStep?.isVercelApp && hasVercel && !hasShipped && appStatus === null && checking;

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
          const isPending = !!s.isVercelApp && vercelAppPending;
          return (
            <li key={s.label} className={`flex items-center gap-3 rounded-lg ${isCurrent ? "bg-brand-container -mx-2 px-2 py-1.5" : ""}`}>
              <span
                className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 ${
                  s.done ? "bg-success text-white"
                  : isPending ? "border-2"
                  : isCurrent ? "bg-brand text-white"
                  : "bg-surface-high text-on-surface-variant"
                }`}
                style={isPending ? { borderColor: "#f59e0b", color: "#f59e0b" } : undefined}
              >
                {s.done ? "✓" : isPending ? "✓" : i + 1}
              </span>
              <span className={`text-sm flex-1 ${
                s.done ? "text-on-surface-variant line-through"
                : isPending ? "text-on-surface-variant"
                : isCurrent ? "text-on-surface font-medium"
                : "text-on-surface"
              }`}>
                {s.label}
                {isPending && <span className="text-[#b45309]"> · confirms on your first build</span>}
              </span>
              {isCurrent && (
                vercelAppChecking
                  ? <span className="text-sm text-on-surface-variant px-4 py-2 shrink-0">Checking…</span>
                  : s.external
                    ? <a
                        href={s.href}
                        target={s.newTab ? "_blank" : undefined}
                        rel={s.newTab ? "noopener noreferrer" : undefined}
                        onClick={s.isVercelApp ? openedVercelInstall : undefined}
                        className="btn-brand text-sm px-4 py-2 shrink-0"
                      >{s.cta} →</a>
                    : <Link href={s.href} className="btn-brand text-sm px-4 py-2 shrink-0">{s.cta} →</Link>
              )}
            </li>
          );
        })}
      </ol>

      {/* Vercel GitHub-app step — honest, real-status hint. The step can't be
          trusted to a click, so we say exactly where the user stands. */}
      {(vercelAppPending || (currentStep?.isVercelApp && !vercelAppChecking)) && (
        <p className="text-xs text-on-surface-variant mt-3">
          {appStatus?.requireReauth ? (
            <>Vercel’s GitHub access needs re-authorizing — open the Vercel app, reconnect GitHub, then{" "}<RecheckButton onClick={checkVercelApp} checking={checking} />.</>
          ) : vercelAppPending ? (
            <>Vercel’s GitHub app is set up — we’ll confirm it’s connected automatically on your first build, so you can keep going. Did you choose <b className="text-on-surface">“All repositories”</b>?{" "}<RecheckButton onClick={checkVercelApp} checking={checking} /> to confirm now.</>
          ) : (
            <>On the GitHub page, pick <b className="text-on-surface">“All repositories”</b> (every project is a fresh repo Vercel needs to reach). It checks off once we confirm the connection — on re-check or your first deploy.</>
          )}
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

function RecheckButton({ onClick, checking }: { onClick: () => void; checking: boolean }) {
  return (
    <button onClick={onClick} disabled={checking} className="text-brand-dim hover:underline disabled:opacity-60">
      {checking ? "checking…" : "re-check"}
    </button>
  );
}
