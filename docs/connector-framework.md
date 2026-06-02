# OnlyAIApp — Connector Framework Spec
**Status:** Spec (not built) · **Owner:** XP · **Scope:** OnlyAIApp (vibe-launchpad)
**Purpose:** One system to provision/connect everything a member's OS needs — email, AI, payments, domain, social login, analytics — with **near-zero member effort**, by pushing every connector to the least-friction method available. Generalizes the provisioning we already do (GitHub / Supabase / Vercel) into a registry-driven framework.

> **Doctrine:** deterministic-first. Connections live in the DB; the app and the build workspace work even if the AI layer (or any one connector) is down. The connector framework *uses* the app; it is not the app.

---

## 1. Principles

1. **Three friction levels per connector — use the best available:**
   - **OAuth one-click** → a button, no keys, no paste.
   - **Managed by default** → OnlyAIApp provides the resource; the member does *nothing*.
   - **Guided wizard + auto-verify** → only when it must be the member's own account; deep links + the app polls until it works.
2. **Always auto-inject + auto-configure.** Once a credential is captured (any method), inject it into the deployed app's env and configure the dependent settings (webhooks, SMTP, redirect URLs). The member never opens a config file.
3. **Only ask when needed.** The blueprint declares what it `needs`; prompt at the moment it's required (e.g. Stripe at "ready to charge," not at build start).
4. **Ownership split:** **core** (GitHub / Supabase / Vercel) = member BYO (they own the running product). **Auxiliary** (email / AI key / analytics) = **managed-by-default**, with handover at graduation. Nobody should create a Resend or Anthropic account just to send a signup email.
5. **Security:** secrets encrypted at rest (`lib/crypto`), injected **server-side only**, never to the client (publishable keys excepted); webhook signatures verified; OnlyAIApp master/service keys never injected into member projects.

---

## 2. The connector registry

One descriptor per connector (a single source of truth the UI + provisioning read):

```ts
type ConnectorMethod = "oauth" | "managed" | "token" | "wizard";

interface Connector {
  id: "resend" | "stripe" | "ai" | "domain" | "google_oauth" | "analytics";
  label: string;
  icon: string;
  method: ConnectorMethod;          // best available path
  scope: "core" | "auxiliary";
  ownership: "byo" | "managed_handover";
  provision(ctx): Promise<Connection>;        // do the connect/create
  injectEnv(conn, project): Record<string,string>; // keys → Vercel env
  autoConfigure?(conn, project): Promise<void>;     // webhooks / SMTP / redirects
  verify(conn, project): Promise<{ ok: boolean; detail?: string }>; // poll until it works
}
```

**Storage:** reuse the existing `oauth_connections` table (`user_id, provider, access_token` [encrypted], `metadata`). Add columns: `managed boolean default false`, `status text`, `verified_at timestamptz`.

**Reuse what exists:**
- `injectEnv` → `addVercelEnvVars` (`lib/vercel`)
- `verify` → `getDeploymentById` / page-fetch / API ping (same muscle as the "done ≠ deployed" fix)
- encryption → `lib/crypto`
- DB/auth provisioning → `lib/supabase-mgmt` (`createSupabaseProject`, `runMigration`, `getProjectKeys`)

---

## 3. Blueprint `needs` manifest

Each blueprint declares its required connectors, so the member is only asked for what their OS actually uses:

```ts
// e.g. lead-qualifier blueprint
needs:         ["supabase", "resend", "ai"],   // prompt up front
needsOnDemand: ["stripe"],                       // prompt only when a paywall step is reached
```

OnlyAIApp prompts only for declared `needs`, defers `needsOnDemand` until hit.

---

## 4. Per-connector spec

| Connector | Method (easiest) | Member effort | Provisions | Auto-config | Verify | Ownership |
|---|---|---|---|---|---|---|
| **GitHub** | OAuth ✓ | 1 click | private repo from template | — | repo exists | BYO |
| **Supabase** | OAuth (in flight) | 1 click | project (DB+auth+storage), keys | inject URL/anon | project READY | BYO |
| **Vercel** | token (today) / OAuth | 1 click | project + deploy | inject env | deploy READY | BYO |
| **Email (Resend)** | **Managed** | **none** | OnlyAIApp Resend + per-member sending subdomain | DNS (SPF/DKIM) + wire **Supabase Auth SMTP** | send test email | managed → handover |
| **AI key** | **Managed (pooled, proxied)** | **none** | route AI calls through OnlyAIApp proxy w/ per-member cap | inject proxy URL (not raw key) | test completion | managed → handover |
| **URL** | **Managed subdomain** | **none** | `<slug>.onlyaiapp.com` on member's Vercel project | add domain via Vercel API | DNS + cert green | managed (custom = BYO wizard) |
| **Stripe** | **Stripe Connect (OAuth)** | 1 click, on-demand | connected account | auto-create webhook → member URL; inject pk + store wh secret | webhook ping | BYO (payouts → their bank) |
| **Social login (Google)** | shared OAuth app (managed) or wizard | 1 click / deferred | provider creds | auto-set redirect URLs in Supabase Auth | test sign-in | managed or BYO |
| **Analytics** | managed project / 1 key | ~0 | PostHog project | inject client key | event received | managed or BYO |

### Notes per connector
- **Email** is three layers, not one key: (1) API key, (2) **verified sending domain** (DNS), (3) **wire into Supabase Auth SMTP** so signup/confirm/magic-link/reset come from the member's brand, not Supabase's rate-limited default. Managed-by-default collapses all three to zero member effort.
- **AI key:** prefer a **proxy** (member's app calls `onlyaiapp.com/api/ai/...`, OnlyAIApp adds the key server-side + meters/caps) over injecting the raw key — the key never lands in a member-controlled repo/env. Cap works like build credits.
- **Stripe:** must be the member's own account (payouts go to their bank), but **Stripe Connect (OAuth)** makes it one-click and lets OnlyAIApp auto-create the webhook + inject the publishable key. Secret stays server-side; verify webhook signatures.
- **Domain:** managed subdomain is instant (Vercel API add + auto-verify). Custom domain reuses the guided DNS wizard + the poll-until-green checks (the automated version of what we did for onlyaiapp.com).

---

## 5. Shared machinery

- **`ConnectorPanel` UI:** for the current build, render its `needs` as rows with status — `○ not connected` / `⏳ verifying` / `✓ connected` — each row rendering the right flow (OAuth button / managed "auto" / wizard). This *is* the provisioning checklist.
- **Auto-inject:** every connector's `injectEnv` runs through `addVercelEnvVars` after connect.
- **Auto-configure:** `autoConfigure` runs the dependent setup (Stripe webhook, Resend SMTP into Supabase, OAuth redirect URLs).
- **Auto-verify:** `verify` polls until green; surfaces a plain-English failure if not (reuse the deploy-verify pattern).
- **Defer/gate:** the panel only shows `needs`; `needsOnDemand` appear when the build reaches that step.

---

## 6. Security guardrails

- Encrypt all tokens (`lib/crypto`) before storing in `oauth_connections`.
- **Server-only secrets:** Stripe secret, Resend key, AI key (or proxy) never reach the client. Publishable keys (Stripe `pk_`, Supabase anon) are client-safe.
- **Stripe:** verify webhook signatures; never log secrets.
- **Managed AI:** proxy so the raw key is never injected into member-controlled env/repo.
- **Never** inject OnlyAIApp's service-role / master keys into member projects.

---

## 7. Build sequence (80/20)

1. **Connector registry + `ConnectorPanel` + reuse env-inject/verify** — the foundation.
2. **Managed email (Resend)** + Supabase-Auth SMTP wiring — nearly every app needs working signup emails. *Highest impact.*
3. **Pooled AI key (proxy + cap)** — most "AI systems" need it.
4. **Managed subdomain** — instant branded URL.
5. **Stripe Connect (OAuth)** — on-demand, when a build sells.
6. **Supabase OAuth** — replaces the token paste (already in flight).
7. **Social login / analytics** — later, blueprint-driven.

> Each step rides the existing provisioning + env-injection + verify machinery. The new work is the registry + the managed providers + the per-connector flow — not a rebuild.

---

## 8. Open decisions

- **Pooled AI key:** inject raw key vs proxy → **recommend proxy** (key never leaves OnlyAIApp).
- **Managed email domain:** one shared domain (member as sub-address) vs **per-member subdomain** → recommend per-member subdomain (better deliverability), automated via API.
- **Handover at graduation:** how managed resources (email domain, AI usage, subdomain) transfer to the member's own accounts when they "graduate" — define when we build managed providers.
- **Connect framing for non-coders:** wording on the `ConnectorPanel` (plain language, "we set this up for you" for managed) — pass through the same copy review as the rest of the app.

---

*End of spec. Build only after the core build-loop + Definition-of-Done/Launch checklist; connectors are how "shipped = launched" actually gets wired. No separate pricing — provisioning is part of the credit (1 credit = build AND launch one working system).*
