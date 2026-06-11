/**
 * Pilot checks — shared types.
 *
 * A "check" inspects a project just before it goes live and returns a single
 * plain-English verdict. The engine (run.ts) runs every registered check,
 * fail-open: a check that errors or times out becomes `skipped`, never a
 * blocker. Pure types only (no server imports) so the client can import the
 * result type for rendering.
 */

export type Severity = "pass" | "warn" | "fail" | "skipped";

/** How the user resolves an issue. `connect` = a one-click in-app link (works on
 *  any tier). `prompt` = a copy-paste instruction they hand to Claude/Codex (the
 *  free DIY path); the in-app auto-fix of these is the Pro/Pilot layer. */
export type Remedy =
  | { kind: "connect"; provider: "vercel" | "supabase" | "github"; href: string; label: string }
  | { kind: "prompt"; label: string; prompt: string }
  | { kind: "none" };

export type CheckResult = {
  id: string;
  title: string;       // short, plain-English
  severity: Severity;
  detail: string;      // what breaks + why, in Maya-language
  remedy: Remedy;
  autoFixable: boolean; // can Pilot (Pro) apply the fix in-app today?
  skipReason?: string;  // present when severity === "skipped"
};

export type CheckContext = {
  project: {
    id: string;
    name: string;
    github_repo_url: string | null;
    supabase_project_ref: string | null;
    vercel_project_id: string | null;
  };
  githubToken?: string;        // decrypted; checks skip their repo scan if absent
  repoFullName?: string | null; // "owner/repo"
  hasSupabaseConn: boolean;
  hasVercelConn: boolean;
};

export type PilotCheck = {
  id: string;
  run(ctx: CheckContext): Promise<CheckResult>;
};
