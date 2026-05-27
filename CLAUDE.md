# Vibe Launchpad — conventions

## What this is
A self-serve portal where developers connect GitHub + Vercel, pick a stack template,
and get a fully provisioned app in under 3 minutes. You own the relationship, the data,
and the subscription revenue.

## Stack
- Next.js 15 App Router · React 19 · TypeScript strict
- Tailwind v4 (CSS-first — config in `app/globals.css`, no `tailwind.config.ts`)
- Supabase (auth + portal DB via `@supabase/ssr`)
- Bun package manager

## Key architecture

### Auth
Supabase Auth — email/password + GitHub OAuth. Session refreshed in `middleware.ts`.
Protected routes: `/dashboard`, `/new-project`.

### OAuth tokens (GitHub, Vercel)
Stored encrypted in `oauth_connections` table via `lib/crypto.ts` (AES-256-GCM).
`ENCRYPTION_KEY` must be set — generate with: `openssl rand -base64 32`

### Provisioning flow (`lib/provisioning/index.ts`)
1. `lib/github/index.ts` — create repo from template via GitHub API (`/repos/{template}/generate`)
2. `lib/vercel/index.ts` — create Vercel project + inject env vars via Vercel API

### Plan limits
Free = 3 projects. Enforced in `POST /api/projects`.
Upgrade path: Stripe (not yet wired — add `lib/stripe/` from `vibe-stack-supabase` template).

## Supabase tables
See `supabase/migrations/001_initial.sql`:
- `profiles` — auto-created on signup via trigger
- `oauth_connections` — encrypted GitHub + Vercel tokens
- `templates` — template catalog (seeded with `vibe-stack-supabase`)
- `projects` — provisioned projects + status
- `events` — funnel analytics log

## Path aliases
`@/*` → repo root

## What to build next
1. [ ] PostHog analytics — capture `project_provisioned`, `user_signed_up`, etc.
2. [ ] Stripe subscription — wire `lib/stripe/` for Pro tier ($19/mo)
3. [ ] Hackathon mode — cohorts, invite codes, organizer dashboard
4. [ ] Stripe Connect — inject platform fee % into provisioned projects
5. [ ] Template library — add `vibe-stack-neon` variant

## gstack workflow
- Plan: `/office-hours` → `/autoplan`
- Review before merge: `/review`
- Ship: `/ship`
- QA: `/qa <preview-url>`
- Security audit before launch: `/cso`
