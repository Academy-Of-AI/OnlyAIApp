-- 011_provisioning_state.sql
-- Provisioning state for robust + recoverable project setup.
-- Lets a failed/partial provision be resumed instead of piling up duplicate
-- "failed" cards: we record the last step reached, how many attempts have run,
-- and a soft-hide marker for superseded/duplicate rows.
-- Idempotent; safe to re-run. Reuses existing columns (status, error,
-- github_repo_url, vercel_project_id, vercel_preview_url, supabase_url,
-- supabase_project_ref) — those are NOT re-added here.

begin;

-- Last step reached: 'github' | 'supabase' | 'vercel' | 'deploy' | 'done'
alter table public.projects add column if not exists provision_step text;

-- How many provisioning attempts have run for this row (incremented on retry).
alter table public.projects add column if not exists provision_attempt_count integer not null default 0;

-- Soft-hide superseded/duplicate failed rows.
alter table public.projects add column if not exists archived_at timestamptz;

-- When the CURRENT provisioning attempt started. Powers two things:
--   1. The "one provision at a time" lease in POST /api/projects — a retry flips
--      a row back to 'provisioning' via an atomic compare-and-swap that only
--      succeeds if the row is 'failed' or a STALE 'provisioning' (started >
--      STALE_PROVISION_MS ago). Two concurrent retries can't both win, so a
--      second run can't spawn orphan repos/DBs past the failure point.
--   2. The stale-attempt recovery UI — a row stuck in 'provisioning' past that
--      window (function timed out / page closed mid-run, so the failure path
--      never recorded it) is shown with a Retry button instead of a dead spinner.
-- Window = STALE_PROVISION_MS in lib/provisioning/steps.ts (mirror of the
-- interval '15 minutes' in migration 009's project_slots_used).
alter table public.projects add column if not exists provision_started_at timestamptz;

commit;
