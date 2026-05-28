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
  objective: "text-violet-300 bg-violet-500/10",
  decision: "text-blue-300 bg-blue-500/10",
  architecture: "text-emerald-300 bg-emerald-500/10",
  gotcha: "text-amber-300 bg-amber-500/10",
  note: "text-neutral-300 bg-white/5",
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
      <form onSubmit={add} className="border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex gap-2">
          <select
            value={kind} onChange={(e) => setKind(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30"
          >
            {KINDS.map((k) => <option key={k.v} value={k.v} className="bg-neutral-900">{k.label}</option>)}
          </select>
          <span className="text-xs text-neutral-500 self-center">
            Captured into the project&apos;s memory, then written to CLAUDE.md.
          </span>
        </div>
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="e.g. Auth uses Supabase SSR; middleware must tolerate missing env vars."
          rows={2}
          className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30 resize-none"
        />
        <button
          type="submit" disabled={saving || !content.trim()}
          className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Add to memory"}
        </button>
      </form>

      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-neutral-600 text-center py-8">
            No memory yet. Capture decisions, architecture, and gotchas — they become CLAUDE.md.
          </p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="group flex items-start gap-3 border border-white/10 rounded-lg px-4 py-3">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 mt-0.5 ${KIND_COLOR[e.kind] ?? KIND_COLOR.note}`}>
              {e.kind}
            </span>
            <span className="text-sm text-neutral-200 flex-1">{e.content}</span>
            <button
              onClick={() => remove(e.id)}
              className="text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-xs shrink-0"
            >
              remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 border-t border-white/10 pt-5">
        <button
          onClick={sync} disabled={syncing}
          className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
        >
          {syncing ? "Syncing…" : "⟳ Sync to CLAUDE.md"}
        </button>
        <span className="text-xs text-neutral-500">Commits CLAUDE.md to your repo so the agent reads it.</span>
      </div>
      {msg && <p className={`text-xs ${msg.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>}
    </div>
  );
}
