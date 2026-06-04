"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DirectorySubmit({ projects }: { projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [tagline, setTagline] = useState("");
  const [shot, setShot] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!projectId || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, tagline: tagline.trim() || undefined, screenshotUrl: shot.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) { setErr(d.error ?? "Couldn't add it."); setBusy(false); return; }
      setOpen(false); setTagline(""); setShot("");
      router.refresh();
    } catch {
      setErr("Network error."); setBusy(false);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="btn-brand text-sm px-4 py-2 shrink-0">
        ＋ Add your app
      </button>
    );
  }

  return (
    <div className="w-full sm:w-96 panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-on-surface">Add to the Directory</p>
        <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface text-sm">✕</button>
      </div>

      <label className="block text-xs text-on-surface-variant space-y-1">
        <span>Project</span>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
          className="cap-input">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>

      <input value={tagline} onChange={(e) => setTagline(e.target.value)}
        placeholder="One line — what does it do?"
        className="cap-input" />

      <div className="space-y-1">
        <input value={shot} onChange={(e) => setShot(e.target.value)}
          placeholder="Screenshot image URL (optional)"
          className="cap-input" />
        <p className="text-[11px] text-outline">Leave blank to auto-capture. Apps behind a login look better with your own dashboard screenshot.</p>
      </div>

      {err && <p className="text-xs text-danger">{err}</p>}

      <button onClick={submit} disabled={busy || !projectId}
        className="btn-brand w-full text-sm px-4 py-2">
        {busy ? "Checking it's live…" : "Add to Directory"}
      </button>
    </div>
  );
}
