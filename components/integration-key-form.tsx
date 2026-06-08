"use client";

import { useState } from "react";

type Field = { env: string; label: string; placeholder?: string };

export function IntegrationKeyForm({
  projectId, name, icon, desc, fields, connected,
}: {
  projectId: string; name: string; icon: string; desc: string; fields: Field[]; connected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/integration`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: vals }),
      });
      const d = await res.json();
      if (!res.ok) setMsg({ text: d.error ?? "Couldn't save." });
      else { setMsg({ ok: true, text: "Saved — redeploy your app to apply." }); }
    } catch {
      setMsg({ text: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span>{icon}</span>
          <span className="font-medium text-on-surface">{name}</span>
          <span className="text-xs text-on-surface-variant truncate hidden sm:inline">· {desc}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {connected && <span className="chip chip-success">Added</span>}
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-brand-dim hover:underline">
            {open ? "Cancel" : connected ? "Update" : "Add key"}
          </button>
        </div>
      </div>
      {open && (
        <form onSubmit={save} className="space-y-2 pt-1">
          {fields.map((f) => (
            <input key={f.env} value={vals[f.env] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [f.env]: e.target.value }))}
              placeholder={f.placeholder ?? f.label} className="cap-input text-sm" />
          ))}
          <div className="flex items-center gap-2 flex-wrap">
            <button disabled={busy} className="btn-brand text-sm px-4 py-1.5">{busy ? "Saving…" : connected ? "Update" : "Save"}</button>
            {msg && <span className={`text-xs ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
