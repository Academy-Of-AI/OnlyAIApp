"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { VercelConnectForm } from "@/components/vercel-connect-form";

function href(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

/**
 * The in-app "Go live" for a `ready` project — closes the READY→LIVE gap.
 * Click → POST /api/projects/:id/deploy. If Vercel isn't connected, it expands
 * the connect form inline and, on return (?deploy=1), auto-fires the deploy so
 * a non-technical user reaches a live URL without ever opening a terminal.
 */
export function DeployButton({ projectId, projectPath }: { projectId: string; projectPath: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "deploying" | "connect" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const fired = useRef(false);

  async function deploy() {
    setState("deploying"); setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/deploy`, { method: "POST" });
      const data = await res.json().catch(() => ({} as { ok?: boolean; liveUrl?: string; error?: string; code?: string }));
      if (res.ok && data.ok) {
        setLiveUrl(data.liveUrl ?? null);
        setState("done");
        router.refresh();
        return;
      }
      if (data.code === "vercel_required") { setState("connect"); setErr(data.error ?? null); return; }
      setErr(data.error ?? "Couldn't start the deploy — try again."); setState("idle");
    } catch {
      setErr("Couldn't reach the server — try again in a moment."); setState("idle");
    }
  }

  // Auto-fire after returning from a fresh Vercel connect (?deploy=1).
  useEffect(() => {
    if (fired.current) return;
    try {
      if (typeof window !== "undefined" && window.location.search.includes("deploy=1")) {
        fired.current = true;
        deploy();
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "done") {
    return (
      <div className="panel p-4 border-l-[3px] border-l-success space-y-2">
        <p className="text-sm font-medium text-on-surface">🎉 Going live — your app is building now.</p>
        <p className="text-xs text-on-surface-variant">First build takes ~1–2 minutes. Refresh this page and the <b>Live app</b> link will appear up top.</p>
        {liveUrl && (
          <a href={href(liveUrl)} target="_blank" rel="noopener noreferrer" className="btn-brand inline-flex text-sm px-4 py-2 mt-1">↗ Open your app</a>
        )}
      </div>
    );
  }

  if (state === "connect") {
    return (
      <div className="panel p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-on-surface">One step to go live: connect Vercel (free)</p>
          <p className="text-xs text-on-surface-variant mt-0.5">One click — we deploy straight after. Your app stays in your own Vercel account; no terminal.</p>
        </div>
        <a
          href={`/api/vercel/oauth?next=${encodeURIComponent(`${projectPath}?deploy=1`)}`}
          className="btn-brand inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-2.5 w-full"
        >▲ Connect Vercel — one click</a>
        <details className="text-xs text-on-surface-variant">
          <summary className="cursor-pointer hover:text-on-surface select-none">Prefer to paste a token instead?</summary>
          <div className="mt-2"><VercelConnectForm redirectTo={`${projectPath}?deploy=1`} /></div>
        </details>
      </div>
    );
  }

  return (
    <div className="panel p-4 border-l-[3px] border-l-brand flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <p className="text-sm font-medium text-on-surface">🚀 Put your app live</p>
        <p className="text-xs text-on-surface-variant mt-0.5">Deploy it to a real URL you can open and share — right here, no terminal needed.</p>
        {err && <p className="text-xs text-danger mt-1">{err}</p>}
      </div>
      <button onClick={deploy} disabled={state === "deploying"} className="btn-brand text-sm font-semibold px-5 py-2.5 shrink-0 disabled:opacity-60">
        {state === "deploying" ? "Going live…" : "Go live →"}
      </button>
    </div>
  );
}
