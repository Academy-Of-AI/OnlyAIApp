#!/usr/bin/env node
/**
 * pilot-canary — post-deploy smoke test: do the live routes actually answer?
 *
 * The hook half of drift #1/#12: a green build is not a working site. After a
 * deploy (or on a schedule), GET a handful of key routes on the LIVE URL and
 * assert each returns a non-error status (< 400; a redirect to /login counts as
 * up). Read-only — plain GETs, no auth, no writes — so it is safe to run against
 * production at any time.
 *
 * Usage:
 *   node scripts/pilot-canary.mjs                       # checks https://onlyaiapp.com
 *   node scripts/pilot-canary.mjs https://staging.url   # checks a custom base
 *   node scripts/pilot-canary.mjs <base> /a /b /c       # custom base + routes
 *
 * Exit 0 = every route answered. Exit 1 = at least one route is down.
 */

const args = process.argv.slice(2);
const BASE = (args[0] || process.env.CANARY_BASE_URL || "https://onlyaiapp.com").replace(/\/$/, "");
// Public routes that must always answer. Authenticated routes 307 → /login,
// which is still "< 400" (up). Override by passing routes after the base URL.
const ROUTES = args.length > 1 ? args.slice(1) : ["/", "/privacy", "/sign-in"];
const TIMEOUT_MS = 12000;

async function check(path) {
  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "OnlyAIApp-Pilot-Canary/1.0" },
    });
    return { path, url, status: res.status, ms: Date.now() - started, ok: res.status > 0 && res.status < 400 };
  } catch (err) {
    return { path, url, status: null, ms: Date.now() - started, ok: false, err: err?.name || "error" };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(ROUTES.map(check));

console.log(`pilot-canary → ${BASE}`);
for (const r of results) {
  const tag = r.ok ? "✓" : "✗";
  const status = r.status ?? r.err ?? "no-response";
  console.log(`  ${tag} ${r.path.padEnd(12)} ${String(status).padEnd(8)} ${r.ms}ms`);
}

const down = results.filter((r) => !r.ok);
if (down.length) {
  console.error(`\npilot-canary: ${down.length}/${results.length} route(s) DOWN on ${BASE}. The site is not fully live.`);
  process.exit(1);
}
console.log(`\npilot-canary: all ${results.length} routes answered. Live.`);
process.exit(0);
