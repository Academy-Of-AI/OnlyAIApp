-- ============================================================
-- OnlyAIApp — The Wall (public build showcase)
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists wall_submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade not null,
  project_id   uuid references projects on delete set null,
  title        text not null,
  tagline      text,
  demo_url     text not null,
  builder_name text,
  upvotes      int not null default 0,
  featured     boolean not null default false,
  created_at   timestamptz default now()
);
alter table wall_submissions enable row level security;

-- Anyone (even logged-out) can read the Wall — it's the public marketing asset.
drop policy if exists "Wall is public" on wall_submissions;
create policy "Wall is public" on wall_submissions for select using (true);

-- Builders manage only their own submissions.
drop policy if exists "Insert own submission" on wall_submissions;
create policy "Insert own submission" on wall_submissions for insert with check (auth.uid() = user_id);
drop policy if exists "Update own submission" on wall_submissions;
create policy "Update own submission" on wall_submissions for update using (auth.uid() = user_id);
drop policy if exists "Delete own submission" on wall_submissions;
create policy "Delete own submission" on wall_submissions for delete using (auth.uid() = user_id);

-- Builder badge on first submission.
alter table profiles add column if not exists is_builder boolean not null default false;

-- Public upvote: security-definer so anon can increment without table write access.
create or replace function wall_upvote(p_id uuid)
returns void language plpgsql security definer as $$
begin
  update wall_submissions set upvotes = upvotes + 1 where id = p_id;
end;
$$;
grant execute on function wall_upvote(uuid) to anon, authenticated;
