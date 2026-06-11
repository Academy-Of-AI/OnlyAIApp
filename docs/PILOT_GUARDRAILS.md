# Pilot Guardrails — codifying the drift catalog into enforcement

Companion to `PILOT_DRIFT_CATALOG.md`. The catalog *names* 12 real drifts. This turns each
into an **enforced** thing — pushed to the lowest rung where violating it is impossible or
fails loudly, owned by one of the three engines.

## The frame: the crew IS Pilot
The three reviewers aren't a process bolted on — they're Pilot's three engines, and every
drift belongs to one:
- **🏛 Architect** — *shape it so the drift can't exist.* Prevention. Pushes each guarantee
  DOWN the enforcement ladder.
- **🧪 Tester** — *prove it isn't happening.* Falsifiable checks, journey verification, the
  Definition-of-Done gate.
- **🎨 Designer** — *show the honest state.* §3: 5 states per surface, no number you can't
  define, every state has an exit, limits before the wall.

Codifying = for each drift, **assign the engine + drop it to the lowest rung.**

## The enforcement ladder (the architect's spine — the whole game)
```
prose in a doc          ← weakest: silent drift. NEVER leave a guarantee here.
review checklist (SOP)  ← a human might catch it
automated lint / hook   ← CI/the harness catches it every time
a test that proves it   ← verified, incl. the negative case
a shared helper/wrapper ← you can't write the code the wrong way
a constraint (DB/type)  ← strongest: the bug literally cannot exist
```
Most of the catalog lived at the **top** (Pilot *notices* at runtime). Codifying drags each
as far DOWN as it goes. "Pilot will flag it" is the *fallback*, not the design.

---

## The exchange — three lenses on the catalog

**Architect opens:** "Half of these shouldn't need Pilot to *notice* — they need a *shape*.
Optimistic-state (#1) isn't a detection problem; it's that any code can write
`status:'deployed'`. Make the success-status writable **only** by the verifier function and
the drift is structurally gone. Same with cross-surface inconsistency (#4): it exists because
the step vocab / limits / filters were *re-authored* per surface. One module each + a lint that
bans duplicates, and two screens *can't* disagree. Push it to a helper/constraint; don't ship a
runtime warning for a thing a shared function would make impossible."

**Tester answers:** "Agreed on prevention — but the two that actually cost the most (blind-spots
A and B) can't be shaped away, because they're about *the gap between what you assumed and what's
real*. No constraint catches 'works on my account' — only **running the real journey from a fresh
account** does. So those need a **hook** (re-run after touching the path) and an **SOP** (trace as
a stranger), plus the one rule that would've saved days: *a claim isn't verified until you've
written the test that could prove it false.* And for #1, even a verifier-only status needs a
**post-deploy canary that HEADs the live URL for a 200** — because 'status says deployed' and
'the URL actually resolves' are different facts, and only the second is the promise."

**Designer closes:** "And whatever the architect makes impossible and the tester proves, the
**user still lives in the in-between** — so the honest-state rules are non-negotiable, and they're
mostly the *same* drifts seen from the front: optimistic-state (#1) → every data surface declares
its **5 states** (loading / empty / partial / error / ready) so nothing shows a confident ✓ it
can't back; vanity numbers (#6) → **no number renders without a defined source**; dead-ends (#7)
→ **every state has an exit**; surprise walls (#8) → **the limit shows before the wall**. These
aren't polish — they're the §3 honesty line, and they're enforceable: a component, a lint, a
review rule."

**The synthesis (defense in depth):** each user-facing drift gets all three — Architect makes
it *hard*, Designer makes the honest state *visible*, Tester makes the seam *falsifiable*. The
internal-only drifts (#3 job shape, #5 config) are mostly Architect+Tester. The two blind-spots
are *process*, not code — they get SOPs + a hook, because that's their lowest real rung.

---

## The codification map

| # | Drift | Owner | Lowest rung reached | The guardrail |
|---|---|---|---|---|
| 1 | Optimistic state | Tester+Designer | helper + canary + 5-states | `settleDeployState()` is the **only** writer of a success status; post-deploy URL-200 canary; surface declares 5 states |
| 2 | Deploy-prereq chain | Architect+Tester | pre-deploy hook | preflight verifies the full chain (GitHub-app/all-repos · `target:production` · commit-identity · env); all external errors through the friendly-error boundary |
| 3 | Unsafe long-job shape | Architect | wrapper | `runProvision()` wrapper enforces persist-per-step + lease + idempotent-reuse + resume; no raw long job allowed |
| 4 | Cross-surface inconsistency | Architect | module + lint | one module per concept (`steps.ts`, `plan.ts`); `activeProjects()` query helper; lint bans duplicated SSOT literals & copy referencing unknown routes |
| 5 | Config / env drift | Tester | env-readiness check | preflight env-readiness + "registered redirect URI == code callback" check |
| 6 | Vanity / undefined numbers | Designer | lint + SOP | every displayed count needs a `// source:` ; define-or-cut review rule |
| 7 | Dead-ends | Designer | DoD rule | "every state has an exit" — gated in Definition of Done |
| 8 | Surprise walls | Designer | component | `<Allowance>` renders remaining count at point-of-use; show-before-wall rule |
| 9 | Hydration / perf | Architect | helper + lint | `formatDate` (fixed locale/UTC); lint bans `Date`/`toLocale*`/`Math.random`/`window` in render |
| 10 | Orphaned / half-wired | Tester | lint | dead-export / no-caller / no-writer check (e.g. the `archived_at` dead-column class) |
| 11 | Value-removing "simplify" | Architect | DoD question | "does this make a *value-critical* step optional?" — explicit DoD gate |
| 12 | Tested-once, assumed-forever | Tester | hook | re-run-the-journey hook fires after any change to deploy/onboarding paths |
| A | "Works on my account" | *process* | SOP + hook | **Fresh-Account SOP** (trace as a stranger / persona-audit) before any flow is "done" |
| B | Unverified correctness | *process* | SOP | **Falsifiable-Claim SOP**: write the test that would prove it false, or it ships as *pending* |

---

## The artifacts

### 🛡 Guardrails — code that makes the wrong thing impossible
1. **Verified-state-only writer.** No `.update({ status: 'deployed' })` (or `shipped`/`done`)
   anywhere except the verifier (`settleDeployState`). A success state can *only* come from a
   confirmed signal. *(Kills #1 at the helper rung.)*
2. **Single-source modules + no-duplicate lint.** Step vocab, status enum, limits, stale-window
   live once; a lint flags any hardcoded copy of them. *(#4, #6, #8.)*
3. **`activeProjects()` query helper.** Every project list goes through one query that applies
   `archived_at is null` + the right status set. *(#4 phantom cards.)*
4. **Deterministic render helpers.** `formatDate`; no raw non-deterministic values in render.
   *(#9.)*
5. **`<Allowance>` component.** Any metered feature shows "N of M left" through one component →
   a limit can't be silently hidden. *(#8.)*
6. **Friendly-error boundary.** External-API errors always pass through the plain-English mapper
   before a user sees them — never raw JSON. *(#2.)*
7. **`runProvision()` job wrapper.** New long/external-resource work *must* use the wrapper that
   bakes in persist-per-step, a lease, idempotent reuse, and resume. *(#3.)*

### 🪝 Hooks — automated gates (CI · pre/post-deploy · Claude Code harness)
1. **Pre-deploy preflight** *(extend `lib/pilot/`)*: the deploy-prerequisite chain verified; warn/
   block on a gap. *(#2.)*
2. **Post-deploy canary** *(extend the canary skill)*: HEAD the real live URL → assert **200**,
   not just "status == deployed". *(#1, #2, #12.)*
3. **CI lints** = the guardrails above, enforced: no raw `toLocale` in render · no direct success-
   status write · no duplicated SSOT literal · no project list missing the archived filter · no
   number without a `// source:` · no orphan export · no copy linking an unknown route.
4. **Claude Code Stop/PostToolUse hook** (you build *in* Claude Code): after a diff touches the
   deploy or onboarding path, the hook injects *"re-run the fresh-account journey + URL-200 before
   you call this done."* — turns SOP B/#12 into something the harness *makes* you do.

### 📋 SOPs — process for what code can't catch (the blind-spots)
1. **Fresh-Account SOP** *(blind-spot A — the #1 cost):* no onboarding/integration flow is "done"
   until traced from a **brand-new account**, not yours. The persona-audit workflow is the tool;
   plain-text verdict lines, not schemas.
2. **Falsifiable-Claim SOP** *(blind-spot B):* before shipping "X works", write the single test
   that would prove it **false**. Can't? It's unverified → label it *pending*, don't ship it green.
   (The `git-namespaces` false-negative is the cautionary tale.)
3. **Definition of Done** *(the umbrella gate):*
   - [ ] journey re-run end-to-end on a **fresh build / fresh account**
   - [ ] the live URL returns **200** (not "status says deployed")
   - [ ] every displayed number has a defined source; none counts hidden/failed/archived rows
   - [ ] every new state declares its **5 states** and has an **exit** (no dead-end)
   - [ ] no raw external error reaches the user
   - [ ] no "simplification" made a **value-critical** step optional
4. **Drift-review cadence:** run the three lenses (architect/tester/designer) on each meaningful
   change — standing review, not a one-off. This very document is the rubric.

---

## The recursive payoff
These guardrails are **two products at once**:
1. **How OnlyAIApp builds safely** — the SOPs/hooks/lints above, applied to this repo.
2. **What Pilot sells** — point the same three engines at *someone else's* repo and the catalog
   entries become their **findings**, the guardrails become their **fix prompts**, the DoD becomes
   their **health score**. The existing-repo "Plan + drift health read" is *this file, executed on
   their code.*

So codifying here isn't overhead — it's the **first build of the product**, validated on the one
codebase you understand best: your own. Harden it here, and the Pilot you ship to others is the
Pilot that already kept *you* on course.
