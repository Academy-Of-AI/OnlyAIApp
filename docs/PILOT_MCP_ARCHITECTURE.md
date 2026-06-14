# Pilot-as-MCP — v2 Architecture & Plan

**Goal:** expose Pilot's guardrail engine (`lib/pilot/`) as a **remote MCP server** that Pro
users connect to from their own **Claude Code** or **Codex**, so the guardrails ride *inside*
the agent they already build with — continuously subscription-gated, with the moat (the drift
catalog + benchmark) staying server-side.

This is not a new product. It's `lib/pilot/` — the same engine the website runs — given a second
front door. The recursive-payoff line in `PILOT_GUARDRAILS.md`, executed: *point the three
engines at the user's own repo, from their own terminal.*

---

## 1. Client reality (verified June 2026 — the constraint that shapes everything)

| Capability | Claude Code | Codex CLI |
|---|---|---|
| Remote streamable-HTTP MCP | ✅ `claude mcp add --transport http <name> <url>` | ✅ `[mcp_servers.<name>] url = "…"` |
| **Bearer token** | ✅ `--header "Authorization: Bearer <t>"` | ✅ `bearer_token_env_var = "PILOT_TOKEN"` |
| **OAuth one-click** | ✅ native (`/mcp` → browser → token stored) | ⚠️ `codex mcp login` exists, but 2026 reports show it needs **DCR (RFC 7591)** and breaks on localhost-callback in headless envs |

**Design consequence (load-bearing):**
- **Bearer token is mandatory and universal** — it is the ONLY path that works in *both* clients
  today. It delivers ~80% of the "super easy + continuously billed" value on its own.
- **OAuth 2.1 is an enhancement** — smooth on Claude Code, best-effort on Codex. Build it as a
  *second door on an unchanged core*, never as a rewrite. If we want Codex's OAuth to work too,
  our authorization server must support **Dynamic Client Registration (RFC 7591)**.

Sources: OpenAI Codex MCP docs (`developers.openai.com/codex/mcp`, `/config-reference`); Codex
issues #15818, #8835, #4828; Claude Code MCP docs (`code.claude.com/docs/en/mcp`).

---

## 2. The shape

```
  User's machine (Claude Code / Codex)
        │  streamable HTTP  +  (Bearer token | OAuth access token)
        ▼
  mcp.onlyaiapp.com  ──►  Next.js route handler  app/api/mcp/[transport]/route.ts
        │                        │
        │                 requireProMcpUser(req)   ◄── THE ONE GATE (auth + plan + limit)
        │                        │  (every tool passes through it — the only door)
        │                        ▼
        │                 lib/pilot/*   ◄── SAME engine the website calls (single source)
        │                        │
        ▼                        ▼
  Supabase (service-role): mcp_tokens · mcp_usage · profiles.plan · Stripe-synced status
```

- **Host inside the existing app** as App-Router route handlers (MCP transport via an adapter
  such as `mcp-handler` / `@modelcontextprotocol/sdk`; exact lib confirmed at build). Reuses the
  existing Vercel deploy, Supabase, and `lib/pilot/` engine — **no second codebase to drift**.
- `mcp.onlyaiapp.com` is a vanity CNAME → same Vercel project. One deploy, one source of truth.

---

## 3. Auth — two doors, one gate

Both doors converge on a single server-side function. **The gate runs on every tool call** — it
is the lowest enforceable rung and the *only* way to reach a tool.

```ts
// lib/pilot/mcp/gate.ts  — the only door to any Pilot tool
async function requireProMcpUser(req): Promise<{ userId: string } > {
  const token = bearerFrom(req) ?? oauthAccessTokenFrom(req);   // door A or door B
  const userId = await resolveToken(token);          // hash-match mcp_tokens OR verify OAuth JWT
  if (!userId) throw mcpError(401, "Connect with your OnlyAI Pro account.");
  const { plan, subActive } = await planFor(userId); // profiles.plan + Stripe-synced status
  if (plan !== "pro" || !subActive)
    throw mcpError(402, "Your OnlyAI Pro plan is inactive — renew at onlyaiapp.com/upgrade.");
  await assertUnderLimit(userId);                     // fair-use; throws 429 w/ "N of M used"
  return { userId };
}
```

**Door A — Bearer token (ship first; works everywhere).** User mints a Personal Access Token in
Settings → "Pilot for Claude Code / Codex". Stored **hashed** (`mcp_tokens.token_hash`), shown
once. Validated per call: hash → row → not revoked → user. Revoke = set `revoked_at`; next call 401s.

**Door B — OAuth 2.1 (v2 polish; one-click).** OnlyAI acts as the OAuth Authorization Server for
the MCP resource:
- Publish RFC 9728 protected-resource metadata so clients discover the AS.
- Support **DCR (RFC 7591)** so Claude Code *and* Codex can self-register.
- User clicks **Connect** → already logged into OnlyAI → one-tap consent → client gets a
  short-lived access token (JWT, ~1h) + refresh. Same downstream gate.

---

## 4. Continuous billing — why it *can't* be bypassed

"Continuously charged" is an **architecture property**, not a policy:
1. Every tool call re-runs `requireProMcpUser` → re-checks the **live** subscription status
   (Stripe webhook keeps `profiles` in sync, as today). Lapse → tools stop next call.
2. The valuable logic (catalog rules, benchmark, LLM-backed analysis) runs **only server-side** —
   nothing of value ships to the user's machine, so there is nothing to run offline.
3. **Fair-use metering** mirrors the existing `HEALTH_READ_LIMITS` / `PLAN_PACK_FAIR_USE`:
   `MCP_LIMITS = { pro: N / month }`. Each call logs to `mcp_usage`; the gate enforces the cap and
   every tool response includes `"N of M Pilot runs left this month"` (kills our own drift #8 —
   surprise wall). True per-call Stripe metered billing is a *later* option, not v2.

Entitlement is cached ≤60s to avoid a DB hit per call, never longer (so a cancel takes effect fast).

---

## 5. Tools — `lib/pilot/*` mapped 1:1 (single source of truth)

Each tool handler calls the **existing** engine function. No reimplementation → the MCP and the
website can't tell two different stories (drift #4).

| MCP tool | Calls | Input (privacy-minimal) |
|---|---|---|
| `pilot_drift_check` | `lib/pilot/run` + `checks/*` | a `git diff` / flagged file excerpts — **not** the whole repo |
| `pilot_preflight` | `checks/deploy-prereq` | deploy config + connected-integration signals |
| `pilot_verify_live` | `canary` | a URL |
| `pilot_repo_health` | `repo-audit` / `repo-read` | repo metadata / supplied file list |
| `pilot_plan` | plan generator | an idea / PRD prompt |

---

## 6. Privacy model (the hybrid promise, preserved even though hosting is remote)

Remote hosting means *some* data crosses the wire — so we minimize and never persist it:
- Tools accept **derived signals / diffs / specific slices**, not "upload my codebase." The user's
  agent reads files locally and sends only the relevant excerpt.
- **Process-and-discard:** source content is never written to disk/DB. `mcp_usage` logs *metadata
  only* (tool name, token counts, cost, ts) — never code.
- Stated as a guarantee in the connect screen + docs.

---

## 7. Data model (new — RLS on, deny-by-default)

```sql
-- Personal access tokens for the MCP (Door A). Hashed at rest; last_four for display.
create table mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_hash text not null unique,
  last_four text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table mcp_tokens enable row level security;
-- user manages own; the MCP server reads via service-role (bypasses RLS).
create policy "own tokens" on mcp_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Usage ledger for fair-use + display. Metadata only — never code.
create table mcp_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  tokens_in int default 0, tokens_out int default 0, cost_usd numeric default 0,
  created_at timestamptz not null default now()
);
alter table mcp_usage enable row level security;
create policy "read own usage" on mcp_usage for select to authenticated
  using (user_id = auth.uid());   -- writes are service-role only (no insert policy)
```
(OAuth, if/when built, adds `oauth_clients` for DCR + token storage — or a vetted library.)
Reuse `profiles.plan` + the Stripe-synced subscription field that already exist — do **not** invent
a parallel billing source.

---

## 8. Guarantee placement (the heart — each promise on its lowest rung)

| Guarantee | Lowest rung it lives on | In v2? |
|---|---|---|
| Only Pro users can call tools | `requireProMcpUser` wrapper, server-side, every call | ✅ |
| Billing is continuous | live plan re-checked per call (≤60s cache) | ✅ |
| Revoked token dies immediately | `revoked_at` checked per call; tokens hashed | ✅ |
| Moat never reaches the client | rules live in server `lib/pilot`; nothing valuable shipped | ✅ by construction |
| Website & MCP can't diverge | both call the same `lib/pilot/*` | ✅ |
| No user source persisted | process-and-discard; `mcp_usage` is metadata-only; RLS on | ✅ |
| Limit visible before the wall | "N of M left" in every tool response + dashboard | ✅ |

---

## 9. Blast radius & phased plan (each phase ships value; OAuth is additive, not a rewrite)

- **Phase 0 — v1 spike (≈1 day, dogfood):** bearer-token MCP, ONE tool (`pilot_preflight` or
  `pilot_drift_check`), hardcoded Pro check. Add it to *your own* Claude Code on vibe-launchpad.
  Test: does it save *you* time on *your* repo? (recursive-payoff proof) — **gates the rest.**
- **Phase 1 — productionize Door A:** `mcp_tokens` + Settings UI (mint/revoke, show-once) +
  `requireProMcpUser` gate + 3–4 tools. **Works in Claude Code AND Codex via token.** This alone
  delivers continuous billing + a one-command install.
- **Phase 2 — metering & honesty:** `mcp_usage` + `MCP_LIMITS` + "N of M left" surface (dashboard
  + tool responses).
- **Phase 3 — v2 "super easy" Door B:** OAuth 2.1 AS + RFC 9728 metadata + **DCR** →
  "Log in with OnlyAI" one-click for Claude Code (and Codex where DCR works).

**Risk-weighting:** Phase 3 (OAuth/DCR) is the hardest and least certain (Codex has open OAuth
bugs). Treat it as a bolt-on to the unchanged Phase-1 core, so a delay there never blocks shipping
the billable product.

---

## 10. The install journeys ("super easy", per client)

**Phase 1 (token) — one copy-paste:**
- *Claude Code:* `claude mcp add --transport http pilot https://mcp.onlyaiapp.com --header "Authorization: Bearer <token>"`
- *Codex:* `codex mcp add` (or paste into `~/.codex/config.toml`):
  `[mcp_servers.pilot]` / `url="https://mcp.onlyaiapp.com"` / `bearer_token_env_var="PILOT_TOKEN"`
- Both started from a Settings card that generates the token and shows the exact line to paste.

**Phase 3 (OAuth) — the north-star:**
- *Claude Code:* click **Connect** → `/mcp` browser flow → done. No token, no JSON.
- *Codex:* `codex mcp login pilot` where DCR works; otherwise fall back to the token line above.
- Billing auto-attaches to the OnlyAI login → one identity, one subscription, one gate.

---

## 11. Open questions to resolve at build time
1. MCP server lib on Next.js App Router (`mcp-handler` vs raw `@modelcontextprotocol/sdk`) —
   confirm streamable-HTTP + auth-header pass-through.
2. Reuse the existing usage table vs the new `mcp_usage` (prefer reuse if one already fits).
3. OAuth: hand-roll the AS vs a hosted/library AS that supports DCR (RFC 7591) — DCR is the gating
   feature for Codex one-click.
4. `MCP_LIMITS` value per Pro tier (margin model, same analysis as Plan Packs / Health reads).

> **Timing:** this is the right *next* move, parked behind getting one real user through the core
> onboarding loop. Phase 0 (the 1-day dogfood spike) is the only part worth doing before that — and
> only because it tests value on the codebase we understand best: our own.
</content>
</invoke>
