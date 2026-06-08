"use client";

import { useState } from "react";

type Verif = { type: string; domain: string; value: string };
type Result = { name: string; verified: boolean; verification: Verif[] };

export function DomainForm({ projectId }: { projectId: string }) {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim() || busy) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/domain`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error ?? "Couldn't add domain.");
      else setResult(d as Result);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="flex gap-2 flex-wrap">
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="app.yoursite.com"
          className="cap-input flex-1 min-w-[180px]" />
        <button disabled={busy} className="btn-brand text-sm px-4 py-2 shrink-0">{busy ? "Adding…" : "Add domain"}</button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
      {result && (
        <div className="panel p-3 space-y-2 text-sm">
          {result.verified ? (
            <p className="text-success">✓ {result.name} is verified and live.</p>
          ) : (
            <>
              <p className="text-on-surface">Added <b>{result.name}</b>. Add this at your domain registrar to verify:</p>
              {result.verification.length === 0 ? (
                <p className="text-xs text-on-surface-variant">Point a <b>CNAME</b> to <span className="mono">cname.vercel-dns.com</span> (or an A record to <span className="mono">76.76.21.21</span>), then it verifies automatically.</p>
              ) : (
                <ul className="space-y-1">
                  {result.verification.map((v, i) => (
                    <li key={i} className="font-mono text-xs text-on-surface-variant break-all">{v.type} · {v.domain} · {v.value}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
