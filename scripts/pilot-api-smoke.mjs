#!/usr/bin/env node
/**
 * Falsifiable proof that the Pilot-API gate BLOCKS (the billing guarantee). Run
 * against a running server:  node scripts/pilot-api-smoke.mjs [--api <url>]
 * Default base http://localhost:3000.
 *
 * Proves the NEGATIVE — the dangerous thing can't happen:
 *   • no token        → 401 no_token
 *   • bogus token     → 401 bad_token
 *   • POST no token   → 401 (a tool is unreachable without the gate)
 * The Pro-gate(402)/limit(429)/happy-path(200) need a real Pro token and are the
 * post-deploy dogfood step — this script asserts the un-bypassable floor.
 */
const base = ((process.argv[process.argv.indexOf("--api") + 1] || process.env.ONLYAI_API || "http://localhost:3000")).replace(/\/+$/, "");
let failed = 0;

async function expect(label, p) {
  try {
    const ok = await p();
    console.log(`${ok ? "✅" : "❌"} ${label}`);
    if (!ok) failed++;
  } catch (e) { console.log(`❌ ${label} — ${e?.message ?? e}`); failed++; }
}
const getJson = async (res) => { try { return await res.json(); } catch { return {}; } };

await expect("GET no token → 401 no_token", async () => {
  const r = await fetch(`${base}/api/pilot/v1`);
  const j = await getJson(r);
  return r.status === 401 && j.code === "no_token";
});

await expect("GET bogus token → 401 bad_token", async () => {
  const r = await fetch(`${base}/api/pilot/v1`, { headers: { Authorization: "Bearer pilot_bogusbogusbogus" } });
  const j = await getJson(r);
  return r.status === 401 && j.code === "bad_token";
});

await expect("POST drift_check no token → 401 (tool unreachable past the gate)", async () => {
  const r = await fetch(`${base}/api/pilot/v1`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool: "drift_check", input: { files: [{ path: "a.tsx", content: "x" }] } }),
  });
  return r.status === 401;
});

await expect("non-Bearer junk Authorization → 401 (not treated as valid)", async () => {
  const r = await fetch(`${base}/api/pilot/v1`, { headers: { Authorization: "Basic abc" } });
  return r.status === 401;
});

console.log(failed === 0 ? "\npilot-api-smoke: all gate-block proofs passed." : `\npilot-api-smoke: ${failed} FAILED.`);
process.exit(failed === 0 ? 0 : 1);
