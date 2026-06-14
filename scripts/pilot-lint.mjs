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
 * Rules — the TWIN of lib/pilot/rules.ts (the product's repo-health engine), so
 * CI catches exactly what the Pilot CLI catches on someone else's repo. Both are
 * derived from PILOT_DRIFT_CATALOG.md, the SSOT — KEEP THE TWO IN SYNC (same ids,
 * predicates, regexes). (A shared module would make drift impossible; that's the
 * proper follow-up — it touches the TS/MJS boundary, so done deliberately.)
 *
 * Each rule: `appliesTo(rel)` (which files) + `find(text, rel)` → [{line, evidence}].
 * A line carrying `// pilot-lint-ok` is always skipped (justified exception).
 */
const isRenderFile = (p) =>
  /(^|\/)(app|components|src|pages)\//.test(p) && /\.(tsx|jsx)$/.test(p);
const isRouteFile = (p) =>
  /(^app\/api\/.*route\.(ts|js)$)|(^pages\/api\/.*\.(ts|js)$)|(actions\.(ts|js)$)/.test(p);

/** Scan a file line-by-line with a regex, honouring the inline pilot-lint-ok escape. */
function lineScan(text, re) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(OK)) continue;
    if (re.test(lines[i])) hits.push({ line: i + 1, evidence: lines[i].trim().slice(0, 200) });
  }
  return hits;
}

const RULES = [
  {
    id: "hydration-toLocale",
    drift: "#9 hydration/perf",
    appliesTo: isRenderFile,
    find: (text) => lineScan(text, /\.toLocale(Date|Time)?String\s*\(/),
    message:
      "Raw toLocale*String in a rendered component causes a server/client hydration mismatch. " +
      "Use formatDate() from lib/date.ts (pins locale + UTC).",
  },
  {
    id: "hydration-random-in-render",
    drift: "#9 hydration/perf",
    appliesTo: isRenderFile,
    find: (text) => lineScan(text, /Math\.random\s*\(/),
    message:
      "Math.random() in a rendered component differs between server and client → hydration mismatch. " +
      "Compute it in an effect (client-only) or pass a stable seed from the server.",
  },
  {
    id: "long-job-no-maxduration",
    drift: "#3 unsafe long-job shape",
    appliesTo: isRouteFile,
    find: (text, path) => {
      const aiOrEmail =
        /@anthropic-ai\/sdk|messages\.create|generateText|streamText|from\s+['"]openai['"]|\.emails\.send|sendMail/;
      const hasGuard =
        /export\s+const\s+maxDuration|ReadableStream|StreamingTextResponse|toDataStreamResponse|toTextStreamResponse/;
      if (!aiOrEmail.test(text) || hasGuard.test(text)) return [];
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(OK)) continue;
        if (aiOrEmail.test(lines[i])) return [{ line: i + 1, evidence: `${path}: ${lines[i].trim().slice(0, 160)}` }];
      }
      return [];
    },
    message:
      "Long/external work (an AI call or send-in-a-loop) in a request with no timeout guard can hit the " +
      "host function limit (Vercel kills >300s). Add `export const maxDuration`, stream the response, or " +
      "move it to a background job.",
  },
  {
    id: "optimistic-success-status",
    drift: "#1 optimistic state",
    appliesTo: (p) => /\.(ts|tsx|js|jsx)$/.test(p),
    find: (text) => lineScan(text, /status:\s*["'](deployed|published|live|completed|success)["']/),
    message:
      "A success status (deployed/published/live/completed) written right after triggering an async action " +
      "claims success before it's real. Write it ONLY after a check confirms the outcome (READY signal / 200 " +
      "on the live URL), or add `// pilot-lint-ok: <why this is verified>` if a check above already confirms it.",
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
  console.error(`      → ${v.rule.message}\n`);
}
console.error(`Fix the above, or add \`// ${OK}: <reason>\` to a line that is a verified-state writer.`);
process.exit(1);
