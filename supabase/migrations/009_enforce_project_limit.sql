-- 009_enforce_project_limit.sql
-- Atomic backstop for the per-user project limit (QC TOCTOU finding, 8a3c34e audit).
--
-- The app pre-checks `count(live projects) < limit` and INSERTs in a separate
-- statement, with nothing tying the two together. Two concurrent
-- POST /api/projects (or a double-submit) can both pass the check and both
-- insert — a free=1 user ends up with 2+ projects. This adds a DB-level backstop:
-- a BEFORE INSERT trigger that takes a per-user advisory lock (serializing that
-- user's concurrent inserts) and rejects an insert that would exceed the user's
-- dynamic limit. Under READ COMMITTED, once the first insert commits, the second
-- waiter's count sees it and is correctly rejected.
--
-- The limit + slot rules MUST mirror lib/plan.ts projectLimit() and the app's
-- owned-count. Keep them in sync.

-- Dynamic limit — mirror lib/plan.ts projectLimit():
--   base PROJECT_LIMITS[plan] (free 1 / core 8 / pro 8)
--   + bonus_projects (>=0) + opt-in (marketing_consent AND non-empty phone)
--   capped at PROJECT_CEILING = 8.
create or replace function public.project_limit_for(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select least(
    8,
    (case p.plan when 'pro' then 8 when 'core' then 8 else 1 end)
    + greatest(0, coalesce(p.bonus_projects, 0))
    + (case when p.marketing_consent is true
              and p.phone is not null
              and length(btrim(p.phone)) > 0
            then 1 else 0 end)
  )::int
  from public.profiles p
  where p.id = p_user_id;
$$;

-- Slots in use — mirror the app's owned-count: everything EXCEPT failed and
-- never-finished (stale > 15 min) provisioning attempts, so a failed/abandoned
-- create never permanently burns a slot (a self-healing count-time reaper).
create or replace function public.project_slots_used(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from public.projects
  where user_id = p_user_id
    and status <> 'failed'
    and not (status = 'provisioning' and created_at < now() - interval '15 minutes');
$$;

-- BEFORE INSERT guard.
create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used  integer;
begin
  -- Serialize concurrent inserts for THIS user so count+insert is atomic.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));

  v_limit := coalesce(public.project_limit_for(new.user_id), 1);
  v_used  := public.project_slots_used(new.user_id);

  if v_used >= v_limit then
    raise exception 'project_limit_exceeded (limit=% used=%)', v_limit, v_used;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_project_limit on public.projects;
create trigger trg_enforce_project_limit
  before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- Internal helpers — used by the trigger + server only; never exposed as RPC.
revoke execute on function public.project_limit_for(uuid)  from public, anon, authenticated;
revoke execute on function public.project_slots_used(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_project_limit()  from public, anon, authenticated;
