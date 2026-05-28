"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EnvVar { key: string; target: string[]; type: string }

export function OpsPanel({
  projectId,
  initialEnvs,
}: {
  projectId: string;
  initialEnvs: EnvVar[];
}) {
  const router = useRouter();
  const [envs, setEnvs] = useState<EnvVar[]>(initialEnvs);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [rolling, setRolling] = useState(false);
  const [rollMsg, setRollMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function addEnv(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEnvs((prev) =>
        prev.some((x) => x.key === key)
          ? prev
          : [...prev, { key, target: ["production", "preview", "development"], type: "encrypted" }],
      );
      setKey(""); setValue("");
      setMsg({ kind: "ok", text: `Saved ${data.key} to Vercel.` });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function rollback() {
    if (!confirm("Roll back to the previous successful deploy? This redeploys the last good commit to production.")) return;
    setRolling(true); setRollMsg(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/rollback`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Rollback failed");
      setRollMsg({ kind: "ok", text: `Rolling back to ${data.sha}… Vercel is deploying it now.` });
      setTimeout(() => router.refresh(), 2500);
    } catch (err) {
      setRollMsg({ kind: "err", text: err instanceof Error ? err.message : "Rollback failed" });
    } finally {
      setRolling(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Env vars */}
      <section>
        <h3 className="text-sm font-semibold mb-1">Environment variables</h3>
        <p className="text-xs text-neutral-500 mb-4">
          Synced to Vercel across production, preview &amp; development. Values are write-only —
          Vercel never returns secrets, so existing ones show as ••••.
        </p>

        <div className="border border-white/10 rounded-xl divide-y divide-white/5">
          {envs.length === 0 && (
            <p className="text-xs text-neutral-600 px-4 py-3">No environment variables yet.</p>
          )}
          {envs.map((e) => (
            <div key={e.key} className="flex items-center justify-between px-4 py-2.5">
              <span className="font-mono text-xs">{e.key}</span>
              <span className="flex items-center gap-3">
                <span className="font-mono text-xs text-neutral-600">••••••••</span>
                <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded">synced</span>
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={addEnv} className="flex flex-col sm:flex-row gap-2 mt-3">
          <input
            value={key} onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="KEY_NAME" spellCheck={false}
            className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:border-white/30 outline-none"
          />
          <input
            value={value} onChange={(e) => setValue(e.target.value)}
            placeholder="value" type="password" autoComplete="off" spellCheck={false}
            className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:border-white/30 outline-none"
          />
          <button
            type="submit" disabled={saving || !key || !value}
            className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Add / update"}
          </button>
        </form>
        {msg && (
          <p className={`text-xs mt-2 ${msg.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{msg.text}</p>
        )}
      </section>

      {/* Rollback */}
      <section>
        <h3 className="text-sm font-semibold mb-1">Rollback</h3>
        <p className="text-xs text-neutral-500 mb-3">
          Re-deploy the last successful production commit — for when a build goes bad.
        </p>
        <button
          onClick={rollback} disabled={rolling}
          className="border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 transition-colors"
        >
          {rolling ? "Rolling back…" : "↺ Roll back to last good deploy"}
        </button>
        {rollMsg && (
          <p className={`text-xs mt-2 ${rollMsg.kind === "ok" ? "text-green-400" : "text-red-400"}`}>{rollMsg.text}</p>
        )}
      </section>
    </div>
  );
}
