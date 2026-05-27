-- ============================================================
-- Migration 003 — Hackathon mode
-- ============================================================

create table hackathons (
  id               uuid primary key default gen_random_uuid(),
  organizer_id     uuid references auth.users on delete cascade not null,
  name             text not null,
  description      text,
  invite_code      text unique not null
    default upper(replace(gen_random_uuid()::text, '-', ''))::text,
  status           text not null default 'active',  -- active | ended | archived
  max_participants int default 200,
  template_id      text references templates default 'vibe-stack-supabase',
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz default now()
);
alter table hackathons enable row level security;
-- Organizers can manage their hackathons
create policy "Organizers manage own hackathons"
  on hackathons for all using (auth.uid() = organizer_id);
-- Anyone can read active hackathons (needed for join page)
create policy "Public read active hackathons"
  on hackathons for select using (status = 'active');

-- Shorten invite code to 8 chars after insert
create or replace function shorten_invite_code()
returns trigger language plpgsql as $$
begin
  new.invite_code = upper(substring(new.invite_code, 1, 8));
  return new;
end;
$$;
create trigger set_short_invite_code
  before insert on hackathons
  for each row execute procedure shorten_invite_code();

create table hackathon_participants (
  id             uuid primary key default gen_random_uuid(),
  hackathon_id   uuid references hackathons on delete cascade not null,
  user_id        uuid references auth.users on delete cascade not null,
  project_id     uuid references projects on delete set null,
  joined_at      timestamptz default now(),
  unique (hackathon_id, user_id)
);
alter table hackathon_participants enable row level security;
create policy "Organizers view participants"
  on hackathon_participants for select
  using (
    exists (
      select 1 from hackathons h
      where h.id = hackathon_id and h.organizer_id = auth.uid()
    )
  );
create policy "Participants manage own record"
  on hackathon_participants for all using (auth.uid() = user_id);

create index on hackathon_participants (hackathon_id);
create index on hackathon_participants (user_id);
