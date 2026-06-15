/**
 * Drift rules — the SINGLE SOURCE OF TRUTH.
 *
 * Imported by BOTH:
 *   • lib/pilot/rules.ts   — the product's existing-repo health engine (typed wrapper)
 *   • scripts/pilot-lint.mjs — the CI gate on our own code
 * so the two can no longer drift apart (the gap that let the hackathons/join
 * "deployed" bug pass CI while the Pilot CLI caught it). Plain JS — no types — so
 * the pure-node CI lint can import it directly. Derived from PILOT_DRIFT_CATALOG.md.
 *
 * Each rule: { id, drift, severity, title, fix, appliesTo(path), find(text, path) }.
 * find() returns [{ line, evidence }] and honours the inline `pilot-lint-ok` escape.
 */

export const isRenderFile = (p) =>
  /(^|\/)(app|components|src|pages)\//.test(p) && /\.(tsx|jsx)$/.test(p);
export const isRouteFile = (p) =>
  /(^app\/api\/.*route\.(ts|js)$)|(^pages\/api\/.*\.(ts|js)$)|(actions\.(ts|js)$)/.test(p);

const OK = "pilot-lint-ok";

/** Scan a file line-by-line with a regex, skipping lines that carry the escape. */
export function lineScan(text, re) {
  const hits = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(OK)) continue;
    if (re.test(lines[i])) hits.push({ line: i + 1, evidence: lines[i].trim().slice(0, 200) });
  }
  return hits;
}

export const REPO_RULES = [
  {
    id: "hydration-toLocale",
    drift: "#9 hydration/perf",
    severity: "medium",
    title: "Date/number formatted with the runtime locale in a rendered component",
    fix: "Pin the locale and timezone (a shared formatDate helper using toLocaleDateString('en-US', { …, timeZone: 'UTC' })) so the server and browser render the same string — otherwise React throws a hydration mismatch and the page re-renders/janks.",
    appliesTo: isRenderFile,
    find: (text) => lineScan(text, /\.toLocale(Date|Time)?String\s*\(/),
  },
  {
    id: "hydration-random-in-render",
    drift: "#9 hydration/perf",
    severity: "low",
    title: "Math.random() in a rendered component",
    fix: "A random value differs between the server render and the client render → hydration mismatch. Compute it in an effect (client-only) or pass a stable seed from the server.",
    appliesTo: isRenderFile,
    find: (text) => lineScan(text, /Math\.random\s*\(/),
  },
  {
    id: "long-job-no-maxduration",
    drift: "#3 unsafe long-job shape",
    severity: "high",
    title: "Long/external work in a request with no timeout guard or streaming",
    fix: "An AI call (or a send-in-a-loop) inside a request hits the host's function time limit (Vercel kills >300s) on large inputs. Set an explicit maxDuration, stream the response, or move the heavy work to a background job that the page polls.",
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
  },
  {
    id: "optimistic-success-status",
    drift: "#1 optimistic state",
    severity: "high",
    title: "A success status is written without confirming the thing actually happened",
    fix: "Writing a success status right after triggering an async action (a deploy, a job) means the UI claims success before it's real — the dominant cause of 'it says done but the link 404s'. Write the success status ONLY after a check confirms the outcome (a READY signal, a 200 on the live URL).",
    appliesTo: (p) => /\.(ts|tsx|js|jsx)$/.test(p),
    find: (text) => lineScan(text, /status:\s*["'](deployed|published|live|completed|success)["']/),
  },
];

/* ── The audit engine ──────────────────────────────────────────────────────
   Run the rules over a set of {path, content} files. Pure + deterministic, so
   it runs IDENTICALLY on the server (the website's repo-health read) and inside
   the CLI (where code never leaves the user's machine). One engine, every face. */

const PENALTY = { high: 15, medium: 7, low: 3 };
const RANK = { high: 0, medium: 1, low: 2 };

/** Run every rule over every applicable file → sorted findings (worst first). */
export function auditFiles(files) {
  const out = [];
  for (const f of files) {
    for (const rule of REPO_RULES) {
      if (!rule.appliesTo(f.path)) continue;
      for (const hit of rule.find(f.content, f.path)) {
        out.push({
          ruleId: rule.id, drift: rule.drift, severity: rule.severity,
          title: rule.title, fix: rule.fix,
          file: f.path, line: hit.line, evidence: hit.evidence,
        });
      }
    }
  }
  return out.sort((a, b) =>
    RANK[a.severity] - RANK[b.severity] || a.file.localeCompare(b.file) || a.line - b.line);
}

export function healthScore(findings) {
  return Math.max(0, 100 - findings.reduce((s, f) => s + PENALTY[f.severity], 0));
}

export function grade(score) {
  return score >= 90 ? "A" : score >= 75 ? "B" : score >= 55 ? "C" : "D";
}
