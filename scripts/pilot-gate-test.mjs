#!/usr/bin/env node
/**
 * Falsifiable gate test for the Pilot API (the parts that need a live token, which
 * can't be handled in a chat transcript). Creates a THROWAWAY user, exercises the
 * gate's allow/deny paths against the deployed API, then deletes the user (FK
 * cascade removes its tokens + usage). Prints only PASS/FAIL — never the token.
 *
 *   node scripts/pilot-gate-test.mjs [--api https://onlyaiapp.com]
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (loads .env.local/.env).
 * Pairs with scripts/pilot-api-smoke.mjs (the no-token deny-floor) and the
 * cross-user RLS proof (run via SQL). Together = the gate's full matrix.
 */
import { readFileSync, existsSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const argIdx = process.argv.indexOf("--api");
const API = (argIdx >= 0 ? process.argv[argIdx + 1] : process.env.ONLYAI_API || "https://onlyaiapp.com").replace(/\/+$/, "");
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }

const admin = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

let failed = 0;
const check = (label, cond, got) => { console.log(`${cond ? "✅" : "❌"} ${label}${cond ? "" : `  (got: ${got})`}`); if (!cond) failed++; };
const mint = () => { const t = `pilot_${randomBytes(32).toString("base64url")}`; return { t, hash: createHash("sha256").update(t).digest("hex"), last4: t.slice(-4) }; };
const apiGet = async (token) => { const r = await fetch(`${API}/api/pilot/v1`, { headers: { Authorization: `Bearer ${token}` } }); return { status: r.status, body: await r.json().catch(() => ({})) }; };

console.log(`Testing gate against ${API}\n`);

const email = `pilot-gate-test+${randomBytes(4).toString("hex")}@example.com`;
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email, email_confirm: true, password: randomBytes(15).toString("base64url"),
});
if (cErr) { console.error("Couldn't create throwaway user:", cErr.message); process.exit(1); }
const uid = created.user.id;

try {
  // The handle_new_user trigger should have made a profile; force plan=free.
  await admin.from("profiles").update({ plan: "free" }).eq("id", uid);
  const tok = mint();
  await admin.from("api_tokens").insert({ user_id: uid, name: "gate-test", token_hash: tok.hash, last_four: tok.last4 });

  // A) free plan → 402
  let r = await apiGet(tok.t);
  check("free plan → 402 pro_required", r.status === 402 && r.body.code === "pro_required", `${r.status} ${r.body.code ?? ""}`);

  // B) pro plan → 200 (the verified-token happy path)
  await admin.from("profiles").update({ plan: "pro" }).eq("id", uid);
  r = await apiGet(tok.t);
  check("pro plan → 200 ok", r.status === 200 && r.body.ok === true, `${r.status}`);

  // C) revoked token → 401
  await admin.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("user_id", uid);
  r = await apiGet(tok.t);
  check("revoked token → 401 bad_token", r.status === 401 && r.body.code === "bad_token", `${r.status} ${r.body.code ?? ""}`);

  // D) over the monthly cap → 429 (fresh token + fill usage to the limit)
  const tok2 = mint();
  await admin.from("api_tokens").insert({ user_id: uid, name: "gate-test-2", token_hash: tok2.hash, last_four: tok2.last4 });
  const period = new Date().toISOString().slice(0, 7);
  await admin.from("api_usage").insert(Array.from({ length: 200 }, () => ({ user_id: uid, tool: "drift_check", period })));
  r = await apiGet(tok2.t);
  check("at monthly cap → 429 limit_reached", r.status === 429 && r.body.code === "limit_reached", `${r.status} ${r.body.code ?? ""}`);
} finally {
  await admin.auth.admin.deleteUser(uid).catch(() => {}); // cascade removes tokens + usage
}

console.log(failed === 0 ? "\npilot-gate-test: all gate paths PASS." : `\npilot-gate-test: ${failed} FAILED.`);
process.exit(failed === 0 ? 0 : 1);
