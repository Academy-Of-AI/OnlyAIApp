"use client";

import { useState } from "react";

/**
 * <LaunchCheck/> — the "is it ALIVE?" panel.
 *
 * Pilot's job is to push a build to the finish line, then tell the truth about
 * whether it actually works. This calls GET /api/projects/:id/launch-check and
 * renders the honest readiness verdict: a ✓/○ checklist (deployed & responding,
 * not just a login wall, core features shipped), the single most important
 * blocker, and — only when every check passes — a celebratory "it's alive" state.
 */

type ReadinessCheck = { name: string; pass: boolean; hint?: string };
type Readiness = { ready: boolean; checks: ReadinessCheck[]; blocker: string | null };

export function LaunchCheck({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/launch-check`);
      const json = await res.json().catch(() => ({} as { error?: string; readiness?: Readiness }));
      if (!res.ok) throw new Error(json?.error ?? "Couldn't run the launch check.");
      if (!json?.readiness) throw new Error("No readiness result came back.");
      setData(json.readiness as Readiness);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Launch check failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-display font-bold text-[15px] text-on-surface">Is it alive?</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            The honest finish-line check — deployed, real (not a login wall), and the core shipped.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="btn-brand text-sm px-4 py-2 shrink-0"
        >
          {loading ? "Checking…" : data ? "Re-check" : "Check if it's alive"}
        </button>
      </div>

      {err && <p className="text-xs text-danger">{err}</p>}

      {data && (
        <>
          {/* Celebration — earned only when every check passes. */}
          {data.ready && (
            <div className="rounded-xl p-4 border border-[rgba(15,138,62,0.3)] bg-[rgba(21,164,75,0.06)] text-center space-y-1">
              <p className="text-3xl">🎉</p>
              <p className="font-display font-bold text-on-surface">It&apos;s alive — your app actually works</p>
              <p className="text-xs text-on-surface-variant">
                Deployed, real, and the core is shipped. Go share it.
              </p>
            </div>
          )}

          {/* The checklist. */}
          <ul className="divide-y divide-[var(--color-outline-variant)]">
            {data.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-3 py-2.5">
                <span
                  className={`w-[18px] h-[18px] rounded-full grid place-items-center text-[11px] shrink-0 border ${
                    c.pass ? "bg-success border-success text-white" : "border-outline text-outline"
                  }`}
                  aria-hidden
                >
                  {c.pass ? "✓" : "○"}
                </span>
                <span className="min-w-0">
                  <span className={`text-sm ${c.pass ? "text-on-surface" : "text-on-surface-variant"}`}>{c.name}</span>
                  {!c.pass && c.hint && (
                    <span className="block text-xs text-on-surface-variant mt-0.5">{c.hint}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {/* The single most important next move. */}
          {!data.ready && data.blocker && (
            <div className="border-l-2 border-brand bg-brand-container rounded-r-lg px-4 py-3">
              <p className="text-xs text-brand-dim mb-1 font-medium">Your one next step</p>
              <p className="text-sm text-on-surface">{data.blocker}</p>
            </div>
          )}
        </>
      )}

      {!data && !loading && !err && (
        <p className="text-xs text-outline">
          We fetch your live URL, confirm it&apos;s a real app (not just a sign-in page), and check your
          v1 features are shipped — then tell you the truth.
        </p>
      )}
    </div>
  );
}
