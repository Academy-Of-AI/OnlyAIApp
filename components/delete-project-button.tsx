"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Delete a project (best-effort frees its Supabase + Vercel resources; the
 * GitHub repo is kept). Two-step confirm. `redirectTo` sends you somewhere
 * after success (e.g. the dashboard from the project's Settings); otherwise it
 * refreshes the current view (e.g. the dashboard list).
 */
export function DeleteProjectButton({
  projectId,
  projectName,
  redirectTo,
  variant = "link",
}: {
  projectId: string;
  projectName: string;
  redirectTo?: string;
  variant?: "link" | "button";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function del(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true); setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({} as { error?: string }));
        setErr(d.error ?? "Delete failed."); setDeleting(false); return;
      }
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    } catch {
      setErr("Delete failed."); setDeleting(false);
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-xs">
        <span className="text-danger">Delete &amp; wipe its database?</span>
        <button onClick={del} disabled={deleting}
          className="bg-danger hover:bg-danger-dim text-white px-2.5 py-1 rounded-md disabled:opacity-50">
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(false); }}
          className="btn-ghost px-2.5 py-1 rounded-md">
          Cancel
        </button>
        {err && <span className="text-danger">{err}</span>}
      </span>
    );
  }

  if (variant === "button") {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true); }}
        className="text-sm border border-danger/30 text-danger hover:bg-danger/10 px-4 py-2 rounded-lg transition-colors"
      >
        Delete project
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirming(true); }}
      className="text-xs text-outline hover:text-danger transition-colors"
    >
      Delete
    </button>
  );
}
