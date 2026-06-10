/**
 * Central model selection — the ONE place AI cost is tuned. Each tier is
 * env-overridable so you can re-balance cost/quality in Vercel without a deploy.
 *
 *   plan   — the Plan Pack, the core paid deliverable. Quality model (Sonnet).
 *   reason — mid reasoning: drift detection, re-plan, weekly retro. Sonnet.
 *   light  — cheap summaries + short writes: auto-capture diff digest, career
 *            artifacts. Haiku.
 *
 * (explain-error keeps its own EXPLAIN_MODEL — already Haiku.)
 *
 * History: drift / re-plan / retro / auto-capture / artifacts all ran on
 * claude-opus-4-5 (the priciest model) — overkill for summaries and short
 * writes. Demoted here to cut owner AI cost while leaving the Plan Pack's
 * quality untouched.
 */
export const MODELS = {
  plan: process.env.PLAN_MODEL ?? process.env.BUILD_MODEL ?? "claude-sonnet-4-5",
  reason: process.env.REASON_MODEL ?? "claude-sonnet-4-5",
  light: process.env.LIGHT_MODEL ?? "claude-3-5-haiku-latest",
} as const;
