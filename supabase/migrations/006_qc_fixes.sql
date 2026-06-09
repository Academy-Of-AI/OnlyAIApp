-- 006_qc_fixes.sql
-- QC reconciliation migration.
--
-- Purpose: bring a FRESH database in line with what already exists by hand in
-- the live prod project (mmwnmqewgpmzattaoymo), while being a no-op when run
-- against prod itself. EVERYTHING here is idempotent so it is safe to apply in
-- either direction.
--
-- Verified against live prod (2026-06-09):
--   * profiles already has: build_credits (default 0 -> we set 3), bonus_projects,
--     github_id, display_name, headline, linkedin_url, website_url, avatar_url,
--     phone, marketing_consent.
--   * projects already has: showcase_published, showcase_image, track.
--   * SECURITY DEFINER fns use_build_credit / refund_build_credit /
--     add_build_credits all exist (add_build_credits uses param name p_amount).
--   * Partial unique index profiles_github_id_key already exists.
--   * sync_user_plan() + trigger on_subscription_change on subscriptions exist
--     (from migration 002) and are dropped here — the Stripe webhook is now the
--     single tier-aware writer of profiles.plan.
--
-- NOTE FOR PROD APPLICATION: prod already has all of the above by hand, so this
-- migration is expected to be a no-op there EXCEPT for (a) resetting the
-- profiles.build_credits column default from 0 -> 3 and (b) dropping the
-- legacy sync_user_plan trigger/function. Review before applying to prod.

begin;

-- ---------------------------------------------------------------------------
-- profiles columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists build_credits integer not null default 3;

-- Reconcile the default: prod was created with default 0 by hand; the code/spec
-- expects new free users to start with 3 build credits. This only affects future
-- inserts that omit the column; existing rows are untouched.
alter table public.profiles
  alter column build_credits set default 3;

alter table public.profiles
  add column if not exists bonus_projects integer not null default 0;

alter table public.profiles
  add column if not exists github_id bigint;

-- Portfolio / contact columns the app code reads.
alter table public.profiles
  add column if not exists display_name text;

alter table public.profiles
  add column if not exists headline text;

alter table public.profiles
  add column if not exists linkedin_url text;

alter table public.profiles
  add column if not exists website_url text;

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists phone text;

alter table public.profiles
  add column if not exists marketing_consent boolean not null default false;

-- ---------------------------------------------------------------------------
-- projects columns
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists showcase_published boolean not null default false;

alter table public.projects
  add column if not exists showcase_image text;

alter table public.projects
  add column if not exists track text;

-- ---------------------------------------------------------------------------
-- Partial unique index on profiles.github_id (only when present)
-- ---------------------------------------------------------------------------
create unique index if not exists profiles_github_id_key
  on public.profiles (github_id)
  where github_id is not null;

-- ---------------------------------------------------------------------------
-- Atomic build-credit functions (SECURITY DEFINER so they can update profiles
-- regardless of the caller's RLS context).
-- ---------------------------------------------------------------------------

-- Decrement one build credit atomically. Returns true iff a credit was spent
-- (i.e. the user had build_credits > 0 and a row was updated).
create or replace function public.use_build_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update public.profiles
     set build_credits = build_credits - 1
   where id = p_user_id
     and build_credits > 0;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Refund a single build credit (e.g. when a build fails). Safe to call even if
-- the user has no row; simply increments when the row exists.
create or replace function public.refund_build_credit(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set build_credits = build_credits + 1
   where id = p_user_id;
end;
$$;

-- Grant N build credits to a user. NOTE: the live prod function uses parameter
-- name p_amount; CREATE OR REPLACE cannot rename an existing parameter, so we
-- keep p_amount to stay idempotent against prod.
create or replace function public.add_build_credits(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set build_credits = build_credits + p_amount
   where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Drop the legacy tier-blind plan sync (migration 002).
-- The Stripe webhook is now the single tier-aware writer of profiles.plan;
-- keeping this trigger would overwrite the webhook's correct tier with a
-- coarse value on every subscriptions change.
-- ---------------------------------------------------------------------------
drop trigger if exists on_subscription_change on public.subscriptions;
drop function if exists public.sync_user_plan() cascade;

commit;
