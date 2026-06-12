-- 013_templates_rls.sql
-- Security fix: public.templates is a world-readable blueprint catalog (the
-- project starter templates) exposed via PostgREST, but RLS was DISABLED — the
-- security advisor flags this ERROR (lint=0013_rls_disabled_in_public).
--
-- The data is non-sensitive catalog info (template name/description/GitHub
-- template repo/tags), and it's referenced by FKs from public.projects and
-- public.hackathons. FK validation is NOT subject to RLS, so enabling RLS here
-- does not break those inserts. The app itself reads its template registry from
-- a hardcoded constant (lib/templates.ts), not this table, so the new-project /
-- blueprint flow is unaffected either way.
--
-- Fix: enable RLS and add a SELECT-only policy so reads keep working for
-- everyone (it's meant to be a public catalog). There is intentionally NO
-- insert/update/delete policy — under RLS that means only the service-role key
-- (which bypasses RLS) can write the catalog. Idempotent; safe to re-run.

alter table public.templates enable row level security;

drop policy if exists "templates are world-readable" on public.templates;
create policy "templates are world-readable"
  on public.templates for select using (true);
