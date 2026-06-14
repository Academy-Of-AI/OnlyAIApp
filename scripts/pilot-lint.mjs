#!/usr/bin/env node
/**
 * pilot-lint — the drift catalog, enforced at write-time.
 *
 * The companion to docs/PILOT_DRIFT_CATALOG.md + docs/PILOT_GUARDRAILS.md. The
 * catalog NAMES the drifts; this script makes the highest-confidence ones
 * impossible to ship by failing CI the moment they appear. Pure Node (no deps).
 *
 * The rules themselves live in ONE place — lib/pilot/drift-rules.mjs — imported
 * by both this CI gate AND the Pilot product (lib/pilot/rules.ts), so CI catches
 * exactly what the shipped CLI catches. They can no longer drift apart.
 *
 * Escape hatch: a line carrying `// pilot-lint-ok: <reason>` is allowed (handled
 * inside each rule's find()). Use sparingly; it should point at a verified writer.
 *
 * Exit 0 = clean. Exit 1 = at least one violation (CI fails).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";
import { REPO_RULES as RULES } from "../lib/pilot/drift-rules.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", ".vercel"]);
const OK = "pilot-lint-ok"; // inline escape marker (the rules' find() honour it)

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
  const applicable = RULES.filter((r) => r.appliesTo(rel));
  if (!applicable.length) continue;
  let text;
  try { text = readFileSync(join(ROOT, rel), "utf8"); } catch { continue; }
  for (const r of applicable) {
    // find() honours the pilot-lint-ok escape internally (per line).
    for (const hit of r.find(text, rel)) {
      violations.push({ rel, lineNo: hit.line, rule: r, src: hit.evidence });
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
  console.error(`      → ${v.rule.fix}\n`);
}
console.error(`Fix the above, or add \`// ${OK}: <reason>\` to a line that is a verified-state writer.`);
process.exit(1);
