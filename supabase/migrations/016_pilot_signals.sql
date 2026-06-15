-- Fleet-learning capture (Phase A). Anonymous failure FINGERPRINTS only.
--
-- Privacy is pinned by the SCHEMA, not prose: there is NO column that can hold
-- code, a file path, the offending source line, a repo name, or a URL. The CLI
-- runs the checks LOCALLY (code never leaves the machine) and reports only this
-- enum/number/hash shape. A leak of source is structurally impossible here.
--
-- See docs/PILOT_FLEET_LEARNING.md. Loop A (sharpen existing rules) reads these
-- aggregates; Loop B (propose new rules) is deferred until there's fleet volume.
create table if not exists public.pilot_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anon_repo_id text,                       -- caller-supplied stable-but-anonymous id (no PII)
  rule_id text not null,                   -- OUR rule id, e.g. 'optimistic-success-status'
  drift_class text not null,               -- e.g. '#1 optimistic state'
  severity text not null,                  -- high | medium | low
  file_kind text,                          -- route | component | lib | action | other  (NOT a path)
  outcome text not null default 'new',     -- new | persisted | fixed | suppressed
  stack_tags text[],                       -- coarse: nextjs, supabase, stripe, …
  period text not null,                    -- 'YYYY-MM' (UTC)
  created_at timestamptz not null default now()
);
create index if not exists pilot_signals_rule_period_idx on public.pilot_signals(rule_id, period);
create index if not exists pilot_signals_user_idx on public.pilot_signals(user_id);

alter table public.pilot_signals enable row level security;
-- Aggregate fleet data: the owner dashboard reads ALL rows via the service-role
-- key (bypasses RLS). A signed-in user may read only their OWN rows (self-view +
-- avoids the rls_enabled_no_policy advisor). Writes are service-role only (the
-- API gate) — no insert policy → deny-by-default for the user client.
drop policy if exists "read own pilot signals" on public.pilot_signals;
create policy "read own pilot signals" on public.pilot_signals for select to authenticated
  using (user_id = auth.uid());
