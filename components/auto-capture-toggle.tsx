"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AutoCaptureToggle({ projectId, enabled }: { projectId: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/auto-capture`, {
        method: on ? "DELETE" : "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setOn(!on);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium flex items-center gap-2">
          Auto-capture
          {on && <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded">on</span>}
        </div>
        <p className="text-xs text-neutral-500 mt-1 max-w-md">
          On each push, Launchpad reads your commits and auto-updates memory, milestones, and drift —
          then re-syncs CLAUDE.md. No manual entry.
        </p>
        {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
      </div>
      <button
        onClick={toggle} disabled={busy}
        className={`shrink-0 text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
          on ? "border border-white/15 text-neutral-300 hover:border-white/30"
             : "bg-violet-500 hover:bg-violet-400 text-white"
        }`}
      >
        {busy ? "…" : on ? "Turn off" : "Enable auto-capture"}
      </button>
    </div>
  );
}
