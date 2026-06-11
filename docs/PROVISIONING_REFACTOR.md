# PROVISIONING REFACTOR — SHARED ANCHOR (single source of truth for the swarm)

Every agent MUST read this file first and conform to the CONTRACT below exactly.
Consistency across agents depends on it. Do not improvise field names, signatures,
or endpoint shapes — use the ones specified here verbatim.

## Goal
Make project provisioning robust + recoverable for a NON-TECHNICAL user. Today a
failed provision: (1) piles up duplicate "failed" project cards, (2) has no Retry,
(3) persists external IDs only at the very end (orphans, can't resume), (4) marks
"deployed" before the build is actually ready.

## Root cause (confirmed by Codex, reading this repo)
`provisionProject()` runs every step synchronously; `POST /api/projects` INSERTs a
NEW row on every attempt and saves external IDs only at the end; success is
optimistic.

## SCOPE
IN (this swarm):
- Migration: add provisioning-state columns.
- `provisionProject`: persist each external ID immediately + skip already-completed
  steps (resumable).
- `POST /api/projects`: create-OR-resume ONE row (kill the pile-up) + a retry path +
  per-step persistence wiring + store the failed step on failure.
- Failed-project UI: a "Retry setup" button + show the step it stopped at; the
  "Pick a track" checklist step must NOT count a failed project as done.

OUT — DO NOT TOUCH (deferred, separate effort):
- The SSE → background-job decouple (the "never reaches idle" perf issue). KEEP the
  existing SSE streaming flow as-is.
- Real Vercel-GitHub-app verification.
- True Vercel build-status polling (mark building → webhook). Leave status logic as-is
  except where the CONTRACT says.

## REPO + RULES
- All paths under `C:\Users\ngxie\projects\vibe-launchpad`. READ each file before editing.
- DO NOT: deploy, apply migrations, `git commit`, `git push`. Leave changes in the
  working tree for human review.
- `npx tsc --noEmit` MUST pass at the end.

## CONTRACT (conform exactly)

### 1. DB — new file `supabase/migrations/011_provisioning_state.sql`
Idempotent `ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS`:
- `provision_step text`                         -- last step reached: 'github' | 'supabase' | 'vercel' | 'deploy' | 'done'
- `provision_attempt_count integer not null default 0`
- `archived_at timestamptz`                     -- soft-hide superseded/duplicate failed rows
REUSE existing columns (do NOT re-add): `status, error, github_repo_url,
vercel_project_id, vercel_preview_url, supabase_url, supabase_project_ref`.
Do NOT apply it — just write the file.

### 2. `lib/provisioning/index.ts` — `provisionProject(params, onProgress)`
- Extend `ProvisionParams` with:
  - `existing?: { githubRepoFullName?: string; supabaseProjectRef?: string; vercelProjectId?: string }`
  - `persist?: (patch: { provision_step?: string; github_repo_url?: string; supabase_project_ref?: string; supabase_url?: string; vercel_project_id?: string; vercel_preview_url?: string }) => Promise<void>`
- RESUMABLE: if `existing.githubRepoFullName` is set → skip repo creation, reuse it
  (set repoUrl/repoFullName from it). If `existing.supabaseProjectRef` → skip Supabase
  creation, fetch keys for that ref. If `existing.vercelProjectId` → skip Vercel create.
- After EACH successful external step, call `await params.persist?.(...)` immediately
  (best-effort, wrap in try/catch, never throw from persist):
  - after GitHub: `{ provision_step:'github', github_repo_url }`
  - after Supabase: `{ provision_step:'supabase', supabase_project_ref, supabase_url }`
  - after Vercel: `{ provision_step:'vercel', vercel_project_id, vercel_preview_url }`
  - at the very end: `{ provision_step:'done' }`
- KEEP the existing repo-reuse-on-"already exists" catch (do not regress it). Do NOT
  delete repos when resuming.

### 3. `app/api/projects/route.ts` — `POST`
- Accept optional JSON body `{ projectId?: string }` (retry) alongside the existing
  `{ name, templateId, ... }`.
- CREATE-OR-RESUME (replaces the unconditional INSERT at ~line 148):
  - If `projectId` provided → load that row; 404 if not owned by the user.
  - Else find the most-recent existing row for this user with the SAME `name`, status in
    `('provisioning','failed')`, and `archived_at IS NULL` → reuse it.
  - Else INSERT a new row (status 'provisioning').
  - On reuse: UPDATE `status='provisioning', error=null, provision_attempt_count = provision_attempt_count + 1`.
- Build `existing` from the row's saved IDs (`github_repo_url`→derive full_name,
  `supabase_project_ref`, `vercel_project_id`) and pass to `provisionProject`.
- Wire `persist` to `UPDATE public.projects SET ...patch WHERE id = project.id`.
- On failure (catch): store `error = friendlyProvisionError(message)` AND
  `provision_step = <the step that failed>` (read from the last progress step or the
  thrown context); DO NOT insert a new row.
- KEEP the SSE response shape and all existing `send({step,...})` events unchanged.
- The project-limit pre-check + 009 trigger still apply for genuinely-new projects;
  reuse/retry of an existing row must NOT be blocked by the limit.

### 4. UI
- Failed-project surface (find it — likely `components/project-tabs.tsx` and/or
  `app/(dashboard)/projects/[id]/page.tsx`): when `status === 'failed'`, render:
  - "Setup stopped at: {provision_step or 'the start'}"
  - the stored `error` (already plain-English)
  - a primary **"Retry setup"** button that POSTs `/api/projects` with
    `{ projectId }` and consumes the SSE stream the same way `app/(dashboard)/new-project/page.tsx`
    does (reuse that consumer pattern). Remove the dead "Skip using my docs" path for
    failed projects.
- `components/get-started-checklist.tsx` + `app/(dashboard)/dashboard/page.tsx`: the
  "Pick a track" step's `done` must reflect a NON-failed project. Change the dashboard's
  `hasProject` to `list.some(p => p.status !== 'failed')` (currently `list.length > 0`).

## ACCEPTANCE CRITERIA (verify phase checks ALL)
1. `npx tsc --noEmit` passes (run from the repo root).
2. Retrying a failed project (same name, or `{projectId}`) REUSES the row — no new
   "failed" card is created.
3. `provisionProject` skips any step whose external ID is already saved (resumable).
4. A failed project shows the step it stopped at + a working "Retry setup" button.
5. Happy path (fresh successful provision) is unchanged; SSE events unchanged.
6. The swarm did NOT deploy, did NOT apply the migration, did NOT git commit/push.
