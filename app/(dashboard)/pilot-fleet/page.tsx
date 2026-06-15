import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Owner-only fleet-learning dashboard (Phase A). Reads the anonymous failure
 * fingerprints in pilot_signals — which rules fire across the fleet and whether
 * they linger — to sharpen the rules (Loop A). Cross-user aggregate, so it reads
 * via the service-role client and is gated to the owner id. No code is shown
 * because none is stored (metadata-only by schema). See docs/PILOT_FLEET_LEARNING.md.
 */
export default async function PilotFleetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const ownerId = process.env.PILOT_OWNER_USER_ID ?? process.env.FEEDBACK_NOTIFY_USER_ID;
  if (!ownerId || user.id !== ownerId) redirect("/dashboard"); // owner-only

  const admin = await createAdminClient();
  const { data: signals } = await admin
    .from("pilot_signals")
    .select("rule_id, drift_class, severity, outcome, anon_repo_id")
    .limit(5000);
  const rows = signals ?? [];

  const byRule = new Map<string, { rule: string; drift: string; total: number; persisted: number; high: number }>();
  for (const s of rows) {
    const e = byRule.get(s.rule_id) ?? { rule: s.rule_id, drift: s.drift_class, total: 0, persisted: 0, high: 0 };
    e.total++;
    if (s.outcome === "persisted") e.persisted++;
    if (s.severity === "high") e.high++;
    byRule.set(s.rule_id, e);
  }
  const agg = [...byRule.values()].sort((a, b) => b.total - a.total);
  const repos = new Set(rows.map((s) => s.anon_repo_id).filter(Boolean)).size;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div>
        <p className="eyebrow">🛩 Pilot</p>
        <h1 className="text-xl font-bold font-display tracking-tight text-on-surface mt-1">Fleet learning</h1>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Anonymous failure patterns across all repos running Pilot — which rules fire and whether they stick.
          No code is stored; only which rule + outcome.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Signals" value={rows.length} />
        <Stat label="Repos (anon)" value={repos} />
        <Stat label="Active rules" value={agg.length} />
      </div>

      {rows.length === 0 ? (
        <div className="panel p-8 text-center text-on-surface-variant space-y-2">
          <p className="text-3xl">📡</p>
          <p>No signals yet.</p>
          <p className="text-xs text-outline">
            Fleet learning is on by default (anonymous patterns only; users can opt out with{" "}
            <code>pilot config telemetry off</code>), so data flows as Pro users run <code>pilot check</code>.
            Never code, paths, or repo names.
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-on-surface-variant border-b border-outline-variant">
                <th className="px-4 py-2.5 font-medium">Rule</th>
                <th className="px-4 py-2.5 font-medium">Drift class</th>
                <th className="px-4 py-2.5 font-medium text-right">Times fired</th>
                <th className="px-4 py-2.5 font-medium text-right">Persisted</th>
              </tr>
            </thead>
            <tbody>
              {agg.map((r) => {
                const persistPct = r.total ? Math.round((r.persisted / r.total) * 100) : 0;
                return (
                  <tr key={r.rule} className="border-b border-outline-variant last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs text-on-surface">{r.rule}</td>
                    <td className="px-4 py-2.5 text-on-surface-variant">{r.drift}</td>
                    <td className="px-4 py-2.5 text-right text-on-surface">{r.total}</td>
                    {/* High persisted% = users ignore it → maybe noisy; low = they act on it → valuable. */}
                    <td className="px-4 py-2.5 text-right text-on-surface-variant">{persistPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-outline">
        Reading this: a rule fired often but rarely fixed (high “persisted”) may be noisy — consider tightening it.
        Fired and acted on (low persisted) is a keeper. This is Loop A (sharpen existing rules); Loop B (propose
        new rules from incidents) is deferred until there’s fleet volume.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-dim p-4">
      <p className="text-xs text-on-surface-variant">{label}</p>
      <p className="text-2xl font-semibold text-on-surface mt-0.5">{value}</p>
    </div>
  );
}
