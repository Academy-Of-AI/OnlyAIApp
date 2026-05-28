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
      <form onSubmit={invite} className="flex gap-2">
        <input
          value={email} onChange={(e) => setEmail(e.target.value)} type="email"
          placeholder="teammate@email.com"
          className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30"
        />
        <button type="submit" disabled={busy || !email}
          className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 disabled:opacity-40 transition-colors">
          {busy ? "…" : "Share (read-only)"}
        </button>
      </form>
      {err && <p className="text-xs text-red-400">{err}</p>}

      <div className="border border-white/10 rounded-xl divide-y divide-white/5">
        {members.length === 0 && <p className="text-xs text-neutral-600 px-4 py-3">Not shared with anyone yet.</p>}
        {members.map((m) => (
          <div key={m.id} className="group flex items-center justify-between px-4 py-2.5">
            <span className="text-sm">{m.member_email}<span className="text-xs text-neutral-600 ml-2">{m.role}</span></span>
            <button onClick={() => remove(m.id)}
              className="text-xs text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">remove</button>
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-500">
        Shared members see a read-only view (status, objective, milestones, recent memory) at /shared.
      </p>
    </div>
  );
}
