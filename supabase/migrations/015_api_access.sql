-- Pilot-as-a-service: API access tokens + usage ledger.
--
-- The hosted Pilot API is the spine; the CLI (and a later MCP shim) are faces of
-- it. These two tables back the ONE entitlement gate (requireProApiCaller):
-- bearer token → user → Pro → fair-use. Names are transport-NEUTRAL (api_*, not
-- mcp_*) on purpose — the same gate serves the CLI, an MCP shim, and the website.
--
-- Privacy is pinned by the SCHEMA, not by prose: api_usage has NO column that can
-- hold source code or a diff — only metadata (tool, period, cost). It is
-- structurally impossible to persist a user's code here.

-- Personal access tokens. Stored HASHED (sha256); plaintext is shown once at mint
-- and never stored. last_four is for display only.
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  last_four text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_tokens_user_idx on public.api_tokens(user_id);

alter table public.api_tokens enable row level security;
-- A user manages ONLY their own tokens. The gate reads via the service-role key,
-- which bypasses RLS — so no broad SELECT policy is needed (deny-by-default).
drop policy if exists "own api tokens" on public.api_tokens;
create policy "own api tokens" on public.api_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Usage ledger — one row per tool call. Metadata ONLY (no code/diff column).
create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  period text not null,            -- 'YYYY-MM' (UTC) for fast monthly counting
  cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists api_usage_user_period_idx on public.api_usage(user_id, period);

alter table public.api_usage enable row level security;
-- A user may READ their own usage (for the "N of M left" display). Writes are
-- service-role only — NO insert policy → deny-by-default for the user client.
drop policy if exists "read own api usage" on public.api_usage;
create policy "read own api usage" on public.api_usage for select to authenticated
  using (user_id = auth.uid());
