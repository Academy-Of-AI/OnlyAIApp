"use client";

import { useState } from "react";

interface Entry { id: string; kind: string; content: string; created_at: string }

const KINDS = [
  { v: "objective", label: "Objective" },
  { v: "decision", label: "Decision" },
  { v: "architecture", label: "Architecture" },
  { v: "gotcha", label: "Gotcha" },
  { v: "note", label: "Note" },
];
const KIND_COLOR: Record<string, string> = {
  objective: "text-brand-dim bg-brand-container",
  decision: "text-info bg-[var(--color-info-container)]",
  architecture: "text-on-surface-variant bg-surface-high",
  gotcha: "text-warn bg-[rgba(245,158,11,0.14)]",
  note: "text-on-surface-variant bg-surface-high",
};

export function MemoryPanel({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Entry[];
}) {
  const [entries, setEntries] = useState<Entry[]>(initial);
  const [kind, setKind] = useState("decision");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEntries((p) => [data.entry, ...p]);
      setContent("");
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(entryId: string) {
    setEntries((p) => p.filter((e) => e.id !== entryId));
    await fetch(`/api/projects/${projectId}/memory?entryId=${entryId}`, { method: "DELETE" });
  }

  async function sync() {
    setSyncing(true); setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/memory/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setMsg({ kind: "ok", text: "CLAUDE.md committed to your repo. Claude Code will pick it up next session." });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="panel p-4 space-y-3">
        <div className="flex gap-2">
          <select
            value={kind} onChange={(e) => setKind(e.target.value)}
            className="bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-brand"
          >
            {KINDS.map((k) => <option key={k.v} value={k.v} className="bg-surface-low">{k.label}</option>)}
          </select>
          <span className="text-xs text-on-surface-variant self-center">
            Captured into the project&apos;s memory, then written to CLAUDE.md.
          </span>
        </div>
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="e.g. Auth uses Supabase SSR; middleware must tolerate missing env vars."
          rows={2}
          className="cap-input resize-none"
        />
        <button
          type="submit" disabled={saving || !content.trim()}
          className="btn-ghost text-sm px-4 py-2 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Add to memory"}
        </button>
      </form>

      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-outline text-center py-8">
            No memory yet. Capture decisions, architecture, and gotchas — they become CLAUDE.md.
          </p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="group flex items-start gap-3 panel rounded-lg px-4 py-3">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 mt-0.5 ${KIND_COLOR[e.kind] ?? KIND_COLOR.note}`}>
              {e.kind}
            </span>
            <span className="text-sm text-on-surface flex-1">{e.content}</span>
            <button
              onClick={() => remove(e.id)}
              className="text-outline hover:text-danger opacity-0 group-hover:opacity-100 transition text-xs shrink-0"
            >
              remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-outline-variant pt-5">
        <button
          onClick={sync} disabled={syncing}
          className="btn-brand text-sm px-4 py-2 disabled:opacity-40 transition-colors"
        >
          {syncing ? "Syncing…" : "⟳ Sync to CLAUDE.md"}
        </button>
        <span className="text-xs text-on-surface-variant">Commits CLAUDE.md to your repo so the agent reads it.</span>
      </div>
      {msg && <p className={`text-xs ${msg.kind === "ok" ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
