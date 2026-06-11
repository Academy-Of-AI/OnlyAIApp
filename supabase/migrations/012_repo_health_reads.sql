-- 012_repo_health_reads.sql
-- Storage for the existing-repo "Plan + drift health read" (the Pilot pointed at
-- a repo the user already owns). Each row is one read: the reverse-engineered
-- draft plan + the objective-standards drift findings + a health score.
--
-- READ-ONLY feature: we never write to the user's GitHub repo. This table only
-- stores the report WE generated, so the user can revisit it and we can meter
-- the free allowance (lib/plan.ts HEALTH_READ_LIMITS).
--
-- Idempotent; safe to re-run.

create table if not exists public.repo_health_reads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  repo_full_name  text not null,            -- "owner/repo"
  score           integer,                  -- 0–100 objective-standards health
  grade           text,                     -- A | B | C | D
  summary         text,
  stack           jsonb default '[]',       -- ["Next.js","Supabase",...]
  draft_plan      jsonb default '{}',       -- { objective, milestones[], source }
  findings        jsonb default '[]',       -- Finding[] (rule hits w/ file:line)
  ai_used         boolean not null default false,
  notes           jsonb default '[]',       -- honest caveats surfaced to the user
  created_at      timestamptz not null default now()
);

alter table public.repo_health_reads enable row level security;

-- A user owns their own reads — insert + read their own, nothing else. (Service
-- role bypasses RLS for any internal review.)
drop policy if exists "users insert own repo reads" on public.repo_health_reads;
create policy "users insert own repo reads"
  on public.repo_health_reads for insert with check (auth.uid() = user_id);

drop policy if exists "users read own repo reads" on public.repo_health_reads;
create policy "users read own repo reads"
  on public.repo_health_reads for select using (auth.uid() = user_id);

drop policy if exists "users delete own repo reads" on public.repo_health_reads;
create policy "users delete own repo reads"
  on public.repo_health_reads for delete using (auth.uid() = user_id);

create index if not exists repo_health_reads_user_idx
  on public.repo_health_reads (user_id, created_at desc);
