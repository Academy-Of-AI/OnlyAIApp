-- 007_fair_use_and_free_tier.sql
-- Two product changes, both idempotent and safe to re-run:
--
--  (A) Free tier drops to 1 project. The FIRST 50 builders keep 2 (an
--      early-adopter perk) via a +1 bonus_projects grant. PROJECT_LIMITS.free
--      is now 1 in lib/plan.ts; projectLimit() adds bonus_projects on top, so
--      bonus_projects=1 => 2 usable slots. Referral / opt-in bonuses still
--      stack on top of that, capped at the ceiling of 8.
--        * handle_new_user() now grants bonus_projects=1 while the profile
--          count is < 50 at signup time (0 after).
--        * existing rows: the earliest 50 by created_at are backfilled to
--          bonus_projects >= 1 so the current builders are not demoted.
--
--  (B) Soft fair-use cap on Core/Pro "unlimited" Plan Packs. We never hard-sell
--      honest users (Core 40 / Pro 120 packs per calendar month is far above
--      real use) — the cap only stops runaway owner-AI cost. Tracked per month
--      on profiles; bump_plan_pack_usage() resets the counter when the month
--      rolls over. Free is unaffected (it is already metered by build_credits).

begin;

-- ---------------------------------------------------------------------------
-- (B) Monthly Plan Pack usage counter (Core/Pro soft fair-use)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists plan_packs_used integer not null default 0;

alter table public.profiles
  add column if not exists plan_packs_period text;  -- 'YYYY-MM' of plan_packs_used

-- Atomically count one Plan Pack against the current period, resetting the
-- counter when the month rolls over. Returns the new used-count for the period.
-- SECURITY DEFINER so it can update profiles regardless of the caller's RLS.
create or replace function public.bump_plan_pack_usage(p_user_id uuid, p_period text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  update public.profiles
     set plan_packs_used = case
           when plan_packs_period is distinct from p_period then 1
           else plan_packs_used + 1
         end,
         plan_packs_period = p_period
   where id = p_user_id
   returning plan_packs_used into v_used;
  return coalesce(v_used, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- (A) First-50 early-adopter perk: grant +1 project to the first 50 signups.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, bonus_projects)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    -- count reflects rows BEFORE this insert, so 0..49 => the first 50 users.
    case when (select count(*) from public.profiles) < 50 then 1 else 0 end
  );
  return new;
end;
$$;

-- Backfill: never demote a current builder. The earliest 50 profiles keep >= 1
-- bonus project (greatest() makes this a no-op for anyone already higher).
update public.profiles
   set bonus_projects = greatest(coalesce(bonus_projects, 0), 1)
 where id in (
   select id from public.profiles order by created_at asc limit 50
 );

commit;
