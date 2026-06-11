"use client";

import { useState, useEffect } from "react";

const KEY = "oaa_vercel_ghapp_dismissed_v1";

/**
 * Surfaces the ONE hidden onboarding step: connecting Vercel via OAuth grants
 * API access, but Vercel ALSO needs its GitHub app installed on the user's
 * account to read/deploy their repos. Without it, the first provision fails.
 * Shown once a user has connected Vercel but not shipped yet; dismissible.
 */
export function VercelGithubAppNotice() {
  // Default hidden to avoid a flash before we can read localStorage.
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(localStorage.getItem(KEY) !== "1"); } catch { setShow(true); }
  }, []);
  if (!show) return null;

  return (
    <div className="panel p-4 border-l-2 border-l-brand">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface">▲ One quick step before you build — give Vercel access to your repos</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Connecting Vercel isn’t quite enough: it also needs its GitHub app installed on your account to deploy your code.
            Without it, your first project will fail to provision. It’s one click.
          </p>
          <a
            href="https://github.com/apps/vercel/installations/new"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-brand inline-flex items-center gap-2 text-sm px-4 py-2 mt-2.5"
          >▲ Install the Vercel GitHub app →</a>
          <p className="text-[11px] text-outline mt-2">Pick “All repositories” (or at least the repos OnlyAIApp creates), then come back.</p>
        </div>
        <button
          onClick={() => { try { localStorage.setItem(KEY, "1"); } catch {} setShow(false); }}
          className="text-on-surface-variant hover:text-on-surface text-xl leading-none shrink-0"
          aria-label="Dismiss"
        >×</button>
      </div>
    </div>
  );
}
