/**
 * Drift rules — the objective standard, as data.
 *
 * This is the TypeScript twin of scripts/pilot-lint.mjs: the same drift classes
 * from docs/PILOT_DRIFT_CATALOG.md, but applied to SOMEONE ELSE'S repo for the
 * existing-repo "Plan + drift health read." The CI lint is a hard gate on OUR
 * code; these are an advisory audit against a known-good standard on theirs.
 *
 * The framing matters (and is enforced by being honest in the copy): this is a
 * health read against OBJECTIVE standards — "does this code do a thing we KNOW
 * is a hydration bug / a timeout trap" — NOT an inference of "what they meant to
 * build, then measure drift from it" (that would be unfalsifiable). Every rule
 * here is falsifiable: it points at a line and a specific, defensible reason.
 *
 * Keep in sync with scripts/pilot-lint.mjs. The catalog is the SSOT for both.
 */

export type DriftSeverity = "high" | "medium" | "low";

export interface RuleHit {
  line: number;   // 1-based
  evidence: string; // the offending source line, trimmed
}

export interface RepoRule {
  id: string;
  drift: string;          // catalog class label, e.g. "#9 hydration/perf"
  severity: DriftSeverity;
  title: string;          // plain-English, Maya-facing
  fix: string;            // what to do about it
  /** Repo-relative POSIX path predicate — which files this rule reads. */
  appliesTo: (path: string) => boolean;
  /** Return every hit in this file (line-level OR whole-file logic). */
  find: (text: string, path: string) => RuleHit[];
}

const isRenderFile = (p: string) =>
  /(^|\/)(app|components|src|pages)\//.test(p) && /\.(tsx|jsx)$/.test(p);
const isRouteFile = (p: string) =>
  /(^app\/api\/.*route\.(ts|js)$)|(^pages\/api\/.*\.(ts|js)$)|(actions\.(ts|js)$)/.test(p);

/** Scan a file line-by-line with a regex, returning hits (honours an inline
 *  `pilot-lint-ok` escape so an audited repo can adopt the same convention). */
function lineScan(text: string, re: RegExp): RuleHit[] {
  const hits: RuleHit[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("pilot-lint-ok")) continue;
    if (re.test(lines[i])) hits.push({ line: i + 1, evidence: lines[i].trim().slice(0, 200) });
  }
  return hits;
}

export const REPO_RULES: RepoRule[] = [
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
      const hasGuard = /export\s+const\s+maxDuration|ReadableStream|StreamingTextResponse|toDataStreamResponse|toTextStreamResponse/;
      if (!aiOrEmail.test(text) || hasGuard.test(text)) return [];
      // Flag at the first offending line so the evidence is concrete.
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (aiOrEmail.test(lines[i])) return [{ line: i + 1, evidence: `${path}: ${lines[i].trim().slice(0, 160)}` }];
      }
      return [{ line: 1, evidence: path }];
    },
  },
  {
    id: "optimistic-success-status",
    drift: "#1 optimistic state",
    severity: "high",
    title: "A success status is written without confirming the thing actually happened",
    fix: "Writing status: 'deployed'/'published'/'live'/'completed' right after triggering an async action (a deploy, a job) means the UI claims success before it's real — the dominant cause of 'it says done but the link 404s'. Write the success status ONLY after a check confirms the outcome (a READY signal, a 200 on the live URL).",
    appliesTo: (p) => /\.(ts|tsx|js|jsx)$/.test(p),
    find: (text) =>
      lineScan(text, /status:\s*["'](deployed|published|live|completed|success)["']/),
  },
];
