#!/usr/bin/env node
/**
 * pilot-lint — the drift catalog, enforced at write-time.
 *
 * The companion to docs/PILOT_DRIFT_CATALOG.md + docs/PILOT_GUARDRAILS.md. The
 * catalog NAMES the 12 drifts; this script makes the highest-confidence ones
 * impossible to ship by failing CI the moment they appear. It is pure Node (no
 * deps) so it runs anywhere — locally (`bun run pilot-lint`) and in CI.
 *
 * Doctrine (the enforcement ladder): "Pilot will notice at runtime" is the
 * fallback, not the design. A lint that fails the build is a far lower rung than
 * a runtime warning — the bug literally can't merge. Each rule below maps to a
 * catalog drift class.
 *
 * Escape hatch: a line carrying `// pilot-lint-ok: <reason>` is allowed. Every
 * exception must therefore be justified in code — which is exactly the
 * Falsifiable-Claim SOP applied to lint (you state, in writing, why this write
 * is safe). Use it sparingly; it should point at a verified-state writer.
 *
 * Exit 0 = clean. Exit 1 = at least one violation (CI fails).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", ".vercel"]);
const OK = "pilot-lint-ok"; // inline escape marker

/**
 * Rules. Each maps to a drift class in PILOT_DRIFT_CATALOG.md.
 *  - `scan(rel)`  : which files this rule looks at (relative POSIX path).
 *  - `test(line)` : true when the line violates the rule.
 *  - `message`    : plain-English fix shown on failure.
 *
 * NOTE: lib/pilot/rules.ts holds the TypeScript twin of these regexes for the
 * existing-repo health read (the same rules, applied to someone else's code).
 * Keep the two in sync — both are derived from the catalog, which is the SSOT.
 */
const RULES = [
  {
    id: "no-raw-toLocale-in-render",
    drift: "#9 hydration/perf",
    // app/ + components/ render server-side then hydrate; a runtime-locale date
    // string differs between server (UTC) and client → React hydration mismatch
    // (#418) → the dashboard "freeze". lib/date.ts#formatDate pins locale+TZ.
    scan: (rel) => /^(app|components)\//.test(rel) && /\.(ts|tsx)$/.test(rel),
    test: (line) => /\.toLocale(Date|Time)?String\s*\(/.test(line),
    message:
      "Raw toLocale*String in a rendered file causes a server/client hydration mismatch. " +
      "Use formatDate() from lib/date.ts (pins locale + UTC).",
  },
  {
    id: "no-optimistic-deploy-status",
    drift: "#1 optimistic state",
    // The dominant blind-spot: code flips a project to a success status before
    // anything CONFIRMS it's live, so the UI shows "deployed" + a link that
    // 404s. A success status may be written ONLY by a verifier that has seen a
    // READY deploy (deploy-status route, the page self-heal) — and those carry
    // the pilot-lint-ok marker. Scoped to the project deploy surfaces.
    scan: (rel) =>
      /(^app\/api\/projects\/)|(^app\/\(dashboard\)\/projects\/)/.test(rel) && /\.(ts|tsx)$/.test(rel),
    test: (line) => /status:\s*["'](deployed|shipped)["']/.test(line),
    message:
      "A project may be marked deployed/shipped ONLY by a verifier that has confirmed a READY deploy " +
      "(deploy-status route / page self-heal). Set status:'building' here and let the verifier settle it, " +
      "or add `// pilot-lint-ok: <why this is verified>` if this IS the verifier.",
  },
];

/** Recursively collect candidate files as repo-relative POSIX paths. */
function walk(dir, acc) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(abs, acc);
    } else {
      acc.push(relative(ROOT, abs).split(sep).join("/"));
    }
  }
  return acc;
}

const files = walk(ROOT, []);
const violations = [];

for (const rel of files) {
  const applicable = RULES.filter((r) => r.scan(rel));
  if (!applicable.length) continue;
  let text;
  try { text = readFileSync(join(ROOT, rel), "utf8"); } catch { continue; }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(OK)) continue; // explicitly justified exception
    for (const r of applicable) {
      if (r.test(line)) {
        violations.push({ rel, lineNo: i + 1, rule: r, src: line.trim() });
      }
    }
  }
}

if (violations.length === 0) {
  console.log(`pilot-lint: clean — ${RULES.length} rules across ${files.length} files. No drift found.`);
  process.exit(0);
}

console.error(`\npilot-lint: ${violations.length} drift violation(s) found:\n`);
for (const v of violations) {
  console.error(`  ✗ ${v.rel}:${v.lineNo}  [${v.rule.id} — ${v.rule.drift}]`);
  console.error(`      ${v.src}`);
  console.error(`      → ${v.rule.message}\n`);
}
console.error(`Fix the above, or add \`// ${OK}: <reason>\` to a line that is a verified-state writer.`);
process.exit(1);
