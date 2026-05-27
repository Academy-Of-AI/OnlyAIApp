-- ============================================================
-- Vibe Launchpad — Initial Schema
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Extend auth.users with a public profile
create table profiles (
  id           uuid references auth.users on delete cascade primary key,
  email        text,
  full_name    text,
  avatar_url   text,
  github_username text,
  plan         text not null default 'free',   -- free | pro | org
  stripe_customer_id text,
  created_at   timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can view own profile"  on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- OAuth connections (GitHub token, Vercel token)
create table oauth_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users on delete cascade not null,
  provider         text not null,           -- 'github' | 'vercel'
  access_token     text not null,           -- encrypted at app layer
  provider_user_id text,
  metadata         jsonb default '{}',
  connected_at     timestamptz default now(),
  unique (user_id, provider)
);
alter table oauth_connections enable row level security;
create policy "Users manage own connections"
  on oauth_connections for all using (auth.uid() = user_id);

-- Templates catalog
create table templates (
  id               text primary key,
  name             text not null,
  description      text,
  github_template_owner text not null,
  github_template_repo  text not null,
  stack_tags       text[] default '{}',
  is_active        boolean default true,
  sort_order       int default 0
);
-- Seed default template
insert into templates values (
  'vibe-stack-supabase',
  'Next.js + Supabase',
  'Full-stack starter: App Router, Tailwind v4, Supabase auth + DB, Stripe Connect ready.',
  'xp-luffy',
  'vibe-stack-supabase',
  array['nextjs', 'supabase', 'stripe', 'tailwind'],
  true,
  0
);

-- Projects provisioned by users
create table projects (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users on delete cascade not null,
  name             text not null,
  template_id      text references templates not null default 'vibe-stack-supabase',
  status           text not null default 'pending',
    -- pending | provisioning | deployed | failed
  github_repo_url  text,
  vercel_project_id text,
  vercel_preview_url text,
  supabase_url     text,
  error            text,
  created_at       timestamptz default now(),
  deployed_at      timestamptz
);
alter table projects enable row level security;
create policy "Users manage own projects"
  on projects for all using (auth.uid() = user_id);
create index on projects (user_id, created_at desc);

-- Event log (funnel analytics — also sent to PostHog)
create table events (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users on delete set null,
  event      text not null,
  properties jsonb default '{}',
  created_at timestamptz default now()
);
alter table events enable row level security;
-- events are insert-only from server; no user-facing policy needed
