/**
 * Drift rules for the existing-repo health read — a TYPED view over the shared
 * SSOT in ./drift-rules.mjs. The rule logic lives in ONE place (that .mjs file),
 * imported by both this module (the product's health engine) and
 * scripts/pilot-lint.mjs (the CI gate), so the product and CI can't drift apart.
 * See docs/PILOT_DRIFT_CATALOG.md (the catalog is the SSOT for the rules' intent).
 *
 * Every rule is falsifiable: it points at a line + a specific, defensible reason
 * (e.g. "this code does a thing we KNOW is a hydration bug"), never an inference
 * of what the author "meant" to build.
 */
import { REPO_RULES as RAW_RULES } from "./drift-rules.mjs";

export type DriftSeverity = "high" | "medium" | "low";

export interface RuleHit {
  line: number;     // 1-based
  evidence: string; // the offending source line, trimmed
}

export interface RepoRule {
  id: string;
  drift: string;          // catalog class label, e.g. "#9 hydration/perf"
  severity: DriftSeverity;
  title: string;          // plain-English, Maya-facing
  fix: string;            // what to do about it
  appliesTo: (path: string) => boolean;          // repo-relative POSIX path predicate
  find: (text: string, path: string) => RuleHit[]; // every hit in this file
}

export const REPO_RULES: RepoRule[] = RAW_RULES as unknown as RepoRule[];
