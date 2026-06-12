/**
 * Central model selection — the ONE place AI cost is tuned. Each tier is
 * env-overridable so you can re-balance cost/quality in Vercel without a deploy.
 *
 *   plan   — the Plan Pack, the core paid deliverable + first impression.
 *            Quality model (Sonnet). It's ~80% of owner-AI cost, but it's what
 *            people pay for — never cheap out here.
 *   reason — quality reasoning that FEEDS the build: re-plan / plan-of-record
 *            milestones, and the existing-repo Health draft plan (a prospect's
 *            first taste). Sonnet.
 *   light  — advisory + summaries + short writes where a cheaper model is fine:
 *            auto-capture diff digest, career artifacts, drift check, weekly
 *            retro. Haiku (~5x cheaper than Sonnet on output).
 *
 * (explain-error keeps its own EXPLAIN_MODEL, also Haiku.)
 *
 * IDs kept current: Sonnet 4.6 ($3/$15 per Mtok) + Haiku 4.5 ($1/$5). Drift +
 * weekly retro were moved reason→light (Sonnet→Haiku) — advisory work that
 * doesn't need Sonnet — to cut recurring owner-AI cost; the Plan Pack and the
 * build-feeding reasoning stay on Sonnet for quality. (Previously ran on the
 * now-retired claude-3-5-haiku + Sonnet 4.5.)
 */
export const MODELS = {
  plan: process.env.PLAN_MODEL ?? process.env.BUILD_MODEL ?? "claude-sonnet-4-6",
  reason: process.env.REASON_MODEL ?? "claude-sonnet-4-6",
  light: process.env.LIGHT_MODEL ?? "claude-haiku-4-5",
} as const;
