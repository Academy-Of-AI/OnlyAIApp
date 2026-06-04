"use client";

import { useState } from "react";

interface Member { id: string; member_email: string; role: string; created_at: string }

export function SharePanel({ projectId, initial }: { projectId: string; initial: Member[] }) {
  const [members, setMembers] = useState<Member[]>(initial);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMembers((p) => [data.member, ...p]);
      setEmail("");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed");
    } finally { setBusy(false); }
  }

  async function remove(memberId: string) {
    setMembers((p) => p.filter((m) => m.id !== memberId));
    await fetch(`/api/projects/${projectId}/members?memberId=${memberId}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={invite} className="flex flex-col sm:flex-row gap-2">
        <input
          value={email} onChange={(e) => setEmail(e.target.value)} type="email"
          placeholder="teammate@email.com"
          className="cap-input flex-1 min-w-0"
        />
        <button type="submit" disabled={busy || !email}
          className="shrink-0 btn-brand text-sm px-4 py-2 disabled:opacity-40 transition-colors">
          {busy ? "…" : "Share (read-only)"}
        </button>
      </form>
      {err && <p className="text-xs text-danger">{err}</p>}

      <div className="panel divide-y divide-[var(--color-outline-variant)]">
        {members.length === 0 && <p className="text-xs text-outline px-4 py-3">Not shared with anyone yet.</p>}
        {members.map((m) => (
          <div key={m.id} className="group flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-on-surface">{m.member_email}<span className="text-xs text-outline ml-2">{m.role}</span></span>
            <button onClick={() => remove(m.id)}
              className="text-xs text-outline hover:text-danger opacity-0 group-hover:opacity-100 transition">remove</button>
          </div>
        ))}
      </div>
      <p className="text-xs text-on-surface-variant">
        Shared members see a read-only view (status, objective, milestones, recent memory) at /shared.
      </p>
    </div>
  );
}
