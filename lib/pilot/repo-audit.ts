import { type DriftSeverity } from "./rules";
import { auditFiles, healthScore as _healthScore, grade as _grade } from "./drift-rules.mjs";
import type { RepoDigest, RepoFile } from "./repo-read";

/**
 * The deterministic half of the existing-repo health read.
 *
 * Everything here runs WITHOUT an LLM: the objective-standards audit (rules.ts
 * over the fetched files), a stack sniff, a health score, and a heuristic draft
 * plan derived from the repo's structure. The AI layer (the route) adds a
 * sharper draft plan + narrative ON TOP — but if the AI key is missing or the
 * call fails, this still produces a real, falsifiable report. Fail-open by
 * design: the findings are the floor, the AI is the polish.
 */

export interface Finding {
  ruleId: string;
  drift: string;
  severity: DriftSeverity;
  title: string;
  fix: string;
  file: string;
  line: number;
  evidence: string;
}

export interface DraftMilestone {
  title: string;
  detail: string;
}
export interface DraftPlan {
  objective: string;
  milestones: DraftMilestone[];
  source: "ai" | "heuristic";
}

export interface HealthReport {
  repoFullName: string;
  score: number;            // 0–100, objective-standards health
  grade: "A" | "B" | "C" | "D";
  summary: string;
  stack: string[];
  findings: Finding[];
  draftPlan: DraftPlan;
  aiUsed: boolean;
  notes: string[];          // honest caveats — what we couldn't see / didn't run
}

/** Audit engine — re-exported from the shared SSOT (lib/pilot/drift-rules.mjs) so
 *  the server (here), the CLI (code never leaves the user's machine), and CI all
 *  run byte-identical logic. Typed wrappers preserve this module's public API. */
export function auditRepoFiles(files: RepoFile[]): Finding[] {
  return auditFiles(files) as Finding[];
}
export function healthScore(findings: Finding[]): number {
  return _healthScore(findings);
}
export function grade(score: number): HealthReport["grade"] {
  return _grade(score) as HealthReport["grade"];
}

/** Sniff the stack from package.json deps + tree presence. Best-effort. */
export function detectStack(digest: RepoDigest): string[] {
  const pkg = digest.files.find((f) => f.path === "package.json")?.content ?? "";
  const tree = digest.tree.join("\n");
  const stack: string[] = [];
  const has = (re: RegExp) => re.test(pkg) || re.test(tree);
  if (has(/"next"|next\.config/)) stack.push("Next.js");
  if (has(/"react"/)) stack.push("React");
  if (has(/@supabase/)) stack.push("Supabase");
  if (has(/"stripe"/)) stack.push("Stripe");
  if (has(/@anthropic-ai|openai/)) stack.push("AI (LLM)");
  if (has(/tailwind/)) stack.push("Tailwind");
  if (has(/prisma/)) stack.push("Prisma");
  if (has(/drizzle/)) stack.push("Drizzle");
  if (digest.language && !stack.length) stack.push(digest.language);
  return stack;
}

/**
 * A no-AI draft plan from structure alone. Deliberately conservative and labelled
 * "heuristic" so it's never mistaken for a confident claim about intent — it's a
 * scaffold the user (or the AI layer) refines. Milestones map to surfaces we can
 * actually SEE in the tree; we never assert what's done (we can't know).
 */
export function heuristicDraftPlan(digest: RepoDigest): DraftPlan {
  const firstReadmeLine = (digest.files.find((f) => /readme/i.test(f.path))?.content ?? "")
    .split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find((l) => l.length > 0);
  const objective =
    digest.description?.trim() ||
    firstReadmeLine ||
    `Reverse-engineered from ${digest.fullName} — review and refine this objective.`;

  const tree = digest.tree.join("\n");
  const has = (re: RegExp) => re.test(tree);
  const milestones: DraftMilestone[] = [];
  const add = (title: string, detail: string) => milestones.push({ title, detail });

  if (has(/^(app|src\/app|pages)\//m)) add("App shell & routing", "The pages/routes that make up the product surface.");
  if (has(/(sign-in|login|auth)/i)) add("Authentication", "Sign-in / accounts flow.");
  if (has(/@supabase|supabase\//) || has(/prisma|drizzle|schema\.sql|migrations\//)) add("Data model & database", "Tables, schema, and data access.");
  if (has(/app\/api\/|pages\/api\/|actions\.(ts|js)/)) add("Server logic / API", "API routes and server actions.");
  if (has(/stripe/i)) add("Payments", "Billing / checkout integration.");
  if (has(/vercel|deploy/i)) add("Deploy & go-live", "Getting it onto a real, shareable URL.");
  if (!milestones.length) add("Define the build", "Couldn't infer surfaces from the structure — start by stating the objective and the first slice.");

  return { objective, milestones, source: "heuristic" };
}
