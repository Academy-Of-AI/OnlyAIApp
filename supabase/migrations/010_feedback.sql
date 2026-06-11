-- 010_feedback.sql
-- In-app feedback / bug submitter. Real user reports flow here so we can turn
-- them into new Pilot checks over time (the known-traps grow from real pain).
-- Idempotent; safe to re-run.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete set null,
  project_id  uuid references public.projects on delete set null,
  category    text not null default 'bug',   -- bug | confusing | idea | other
  message     text not null,
  context     jsonb default '{}',            -- { url, check_id, plan, ... }
  status      text not null default 'new',   -- new | triaged | done
  created_at  timestamptz default now()
);

alter table public.feedback enable row level security;

-- Users can file their own feedback and read it back; nobody can read others'.
-- (We review via the service-role key, which bypasses RLS.)
drop policy if exists "users insert own feedback" on public.feedback;
create policy "users insert own feedback"
  on public.feedback for insert with check (auth.uid() = user_id);

drop policy if exists "users read own feedback" on public.feedback;
create policy "users read own feedback"
  on public.feedback for select using (auth.uid() = user_id);

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx  on public.feedback (status, created_at desc);
