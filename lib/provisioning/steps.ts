// Single source of truth for the provisioning step vocabulary and the
// "stale in-flight" window. Three consumers used to hand-maintain their own
// copies — route.ts `coarseStep()`, project-tabs `STEP_LABELS`, and the 011
// enum comment — and would drift on any rename. Define them once, here, and
// import on both sides of the client/server boundary (this file is pure data +
// pure functions, no server-only deps, so a "use client" component can import it).

/** Coarse provisioning milestones, in order. Stored in `projects.provision_step`. */
export const PROVISION_STEPS = ["github", "supabase", "vercel", "deploy", "done"] as const;
export type ProvisionStep = (typeof PROVISION_STEPS)[number];

/** Plain-English label for each coarse step — used by the recovery UI. */
export const STEP_LABELS: Record<ProvisionStep, string> = {
  github:   "creating your GitHub repo",
  supabase: "setting up your database",
  vercel:   "connecting Vercel",
  deploy:   "deploying your app",
  done:     "finishing up",
};

/**
 * Map a fine-grained SSE step name (e.g. "github_start", "supabase_done",
 * "env_done", "deploy_start") down to its coarse milestone. Returns `fallback`
 * for names that don't match a known prefix, so the caller keeps the last
 * known-good step.
 */
export function coarseStep(step: string, fallback: ProvisionStep = "github"): ProvisionStep {
  if (step.startsWith("github")) return "github";
  if (step.startsWith("supabase") || step.startsWith("email")) return "supabase";
  if (step.startsWith("vercel") || step.startsWith("env")) return "vercel";
  if (step.startsWith("deploy")) return "deploy";
  return fallback;
}

/**
 * How long a row may sit in 'provisioning' before it's treated as stale —
 * abandoned/timed-out and safe to reclaim (the "one provision at a time" lease
 * in POST /api/projects) or surface for retry (the recovery UI).
 *
 * MUST match `interval '15 minutes'` in migration 009 (`project_slots_used`).
 * SQL can't import this constant, so that one copy is intentional — keep them
 * in lockstep if you ever change the window.
 */
export const STALE_PROVISION_MS = 15 * 60 * 1000;
