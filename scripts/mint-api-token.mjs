#!/usr/bin/env node
/**
 * Dogfood helper: mint a Pilot API token for a user, until the Settings UI
 * (Phase 1) replaces it. Stores only the sha256 HASH (same as lib/pilot/api/
 * tokens.ts) and prints the plaintext ONCE.
 *
 *   node scripts/mint-api-token.mjs --user <auth-uuid> [--name "my laptop"]
 *   node scripts/mint-api-token.mjs --email you@example.com
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (loads .env.local/.env).
 */
import { readFileSync, existsSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Minimal .env loader (no dep): .env.local wins over .env.
for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

let userId = arg("user");
const email = arg("email");
if (!userId && email) {
  // Best-effort: scan the first pages of auth users for the email.
  for (let page = 1; page <= 10 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error(error.message); process.exit(1); }
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === email.toLowerCase());
    if (u) userId = u.id;
    if (data.users.length < 200) break;
  }
}
if (!userId) { console.error("Provide --user <uuid> or a findable --email."); process.exit(1); }

const token = `pilot_${randomBytes(32).toString("base64url")}`;
const hash = createHash("sha256").update(token).digest("hex");
const { error } = await admin.from("api_tokens").insert({
  user_id: userId, name: arg("name") || "cli", token_hash: hash, last_four: token.slice(-4),
});
if (error) { console.error("Insert failed:", error.message); process.exit(1); }

console.log("\nToken (shown once — copy it now):\n");
console.log("  " + token + "\n");
console.log("Use it:  pilot login " + token + "\n");
