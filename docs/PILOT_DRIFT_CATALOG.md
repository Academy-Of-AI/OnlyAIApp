# Pilot Drift Catalog — training data from the real build

This is **real drift**, harvested from ~20 days of building OnlyAIApp (a non-programmer
vibe-coding with an AI agent). Every entry below is something that *actually broke*,
shipped wrong, or silently misled a user — not generic best-practice. It is the seed
training set for Pilot's checks: the founder's own scar tissue, turned into a co-pilot.

How to read each entry:
- **Saw it as:** the real symptom (what the user/founder experienced).
- **Real cases:** specific incidents + the fix commit, so the check is grounded.
- **Pilot signal:** the *falsifiable* thing to detect (a check, not a vibe).
- **Pilot says:** the plain-English intervention (a non-programmer can act on it).
- **Severity:** 🔴 breaks the promise · 🟠 traps/misleads · 🟡 friction/quality.

These map onto (and expand) the existing P1–P10 trap taxonomy in `lib/pilot/`.

---

## The two blind-spots that dominate (read these first)

For a **solo non-programmer**, two patterns caused most of the pain — and they're the
ones you can *least* verify yourself, so they're Pilot's highest-value job:

### A. "Works on my account" — the configured-state blind spot 🔴
You test on *your own* accounts, where everything is already connected/installed/cached.
A **fresh new user** hits gaps you literally cannot see.
- **Real:** the whole connect/install flow worked for XP but **0/7 fresh personas** reached a
  live app; the Vercel-GitHub-App requirement, the unset OAuth env vars, the false
  localStorage checkmark — all invisible until a real tester used a clean account.
- **Pilot signal:** any flow whose success depends on prior state (a connected token, an
  installed app, a localStorage flag, a cached session). Flag: *"this assumes X is already
  set up — has it been verified from a brand-new account?"*
- **Pilot says:** "Run this as a stranger, not as you. Here's what a fresh account hits that
  yours doesn't: …" (The persona-audit / fresh-session trace is the antidote.)

### B. Asserting correctness you can't verify — the depth blind-spot 🔴
You ship something that *looks* right and *sounds* right, but the claim was never made
falsifiable — so when it's wrong, it ships, and you can't tell.
- **Real:** the `git-namespaces` Vercel check was *assumed* to detect the GitHub-app install;
  it false-negatived in prod (the Marketplace token can't read it) and left correctly-set-up
  users stuck. "I thought this was OK already" recurred for days.
- **Pilot signal:** a correctness claim or runtime assumption ("this API returns X", "this
  state means Y") shipped with no test that could prove it false.
- **Pilot says:** "You're betting X works but nothing here checks it. Make it falsifiable
  *before* shipping — here's the one test that would catch it being wrong."

---

## The catalog

### 1. Optimistic state — "claimed done before it was true" 🔴
The single most recurring drift. The UI asserts a state the system hasn't verified.
- **Real cases:** `status='deployed'` set the instant the deploy was *fired* → the proof
  `*.vercel.app` link 404'd while the UI said "live" (`f3783f2`, `3f4781a`). The Vercel-app
  checkbox went green on a *click*, not an install (`72a9c3d`). Portfolio called a deployed
  **empty template** "a real, working app end-to-end." Checklist showed "Ship it live ✓"
  while "Build" was undone. "Your project is live!" shown before READY.
- **Pilot signal:** a user-facing status/label/"✓" written from an optimistic local action
  (a click, a fired request) rather than a **confirmed read** of the real state. Detect:
  a status set without a following verify; a "done" with no detectable backing signal.
- **Pilot says:** "This says *live/done/shipped*, but the only thing that proves it is a
  READY deployment / a server check — and that isn't read here. Verify it, or relabel it
  honestly (*Deploying…* / *pending*)."
- **Rule:** *a state may only be shown once a signal that can't be faked confirms it.*

### 2. Hidden deploy / integration prerequisite chain 🔴
"Connected" ≠ "will work." External integrations have invisible sub-steps that fail silently.
- **Real cases:** Vercel needs its **GitHub App installed with "All repositories"** (OAuth
  connect isn't enough → raw `bad_request`); the deploy needs **`target:"production"`** or
  Vercel builds a *preview* that never aliases the prod URL → 404 forever (`3f4781a`); Vercel
  **blocks a commit whose author email can't match a GitHub account** → stuck BUILDING
  (`c127db2`, fixed with the `<id>+<login>@users.noreply.github.com` commit); the bare
  `<name>.vercel.app` is wrong for **team** accounts (`-<scope>` suffix); "Sign in with
  Vercel" *cannot* deploy (needs a Marketplace integration).
- **Pilot signal:** for any deploy/integration, enumerate the **full** prerequisite chain and
  check each is actually satisfied — and **verify the live URL returns 200**, not just that
  status says deployed.
- **Pilot says:** "Vercel is connected but can't deploy yet — it also needs its GitHub app on
  *All repositories*, a *production* target, and a matching commit email. Missing: ___."
- (This is what `friendlyProvisionError` + the preflight engine exist to do — grow them here.)

### 3. Long work in a request with no persistence / idempotency / resume 🔴
The shape behind *every* provisioning bug. Doing minutes of external-resource creation
synchronously inside one browser-held request.
- **Real cases:** a synchronous SSE job, no per-step persistence, optimistic status → orphan
  repos, piled-up "failed" cards, false "deployed," **stuck-forever** on a timeout, and
  **concurrent double-runs spawning duplicate DBs**. Fixed with per-step persist + create-or-
  resume + a CAS lease + stale-recovery UI (`b24de3d`), and idempotent repo-reuse on collision
  (`ba50ebc`, token lacks `delete_repo` so rollback can't clean orphans).
- **Pilot signal:** long-running work in a request (esp. creating external resources) lacking
  **persistence after each step**, **idempotency** (reuse-on-conflict), a **lease** (no
  concurrent double-run), a **resume path**, and a **failure-recovery UI**.
- **Pilot says:** "This makes 3 external things in one request with nothing saved between them
  — a timeout or a double-click leaves orphans and a stuck card. Persist each step; make retry
  reuse, not recreate; lock against double-runs."

### 4. Cross-surface inconsistency — the same thing told two ways 🟠
The app contradicts itself across pages, so the user can't trust any of it.
- **Real cases:** **two different onboarding checklists** (Home vs /projects) telling different
  stories — fixed by ONE shared component (`200e2a9`). The `archived_at` filter was on *some*
  list queries but not others → phantom cards (`59146c1`). Free saw a **Delete button that then
  refused** while Pricing said delete = Core. Copy pointed at an **"Ops page" that doesn't
  exist**. Pricing sold "delete & recreate" as Core *after* delete went free.
- **Pilot signal:** the same concept/number/gate represented differently across surfaces; a
  list query missing a filter its siblings have; copy referencing a route/surface that isn't
  real; feature/pricing copy that contradicts the actual gate.
- **Pilot says:** "These two screens disagree about X" / "this list forgot the `archived`
  filter the others use" / "this copy names a page that doesn't exist." *Single source of
  truth — define it once.*

### 5. Config / env / token drift — the silent breakages 🔴
The early-days killers: nothing in the code is wrong, but the *environment* is.
- **Real cases:** Resend email domain misconfigured; a landing `getUser` **refresh-token 429
  storm**; a **private template repo** the token couldn't read; the **Vercel↔GitHub link broken
  by a half-done org move**; a wrong `GITHUB_TEMPLATE_OWNER` env; OAuth env vars unset →
  `?error=unconfigured`; a Supabase OAuth **redirect URI registered ≠ the code's callback path**
  (a self-inflicted instruction mismatch); GitHub tokens **401 with no refresh model**.
- **Pilot signal:** env vars the code reads but aren't set; a dependency/template repo not
  accessible; a registered redirect URI ≠ the code's callback; a token with no refresh path;
  a half-finished migration/move leaving a dead link. (Started in
  `lib/pilot/checks/env-readiness.ts`.)
- **Pilot says:** "The code reads `X_ENV` but it isn't set in prod" / "your Supabase redirect
  is registered as A but the code listens on B."

### 6. Vanity / undefined numbers 🟠
A number you can't define, or that doesn't match what's on screen.
- **Real cases:** **"Proof Points" = shipped + milestones** (an invented metric, cut). "Apps
  shipped" counting **empty templates**. **"Building 3" / "In progress 3"** counting *failed*
  and *archived* projects the list didn't even show.
- **Pilot signal:** a displayed count with no defensible definition, OR whose query doesn't
  reconcile with the list it sits above.
- **Pilot says:** "Define this number or cut it — and it currently counts things the list
  below doesn't show."

### 7. Dead-ends — a state you can enter but not exit 🟠
- **Real cases:** a free user stuck with a **failed/BUILDING project they couldn't delete** →
  at their 1-project limit → could *never build again* (`1b92d20`). The **Cindy lockout**:
  1-GitHub enforcement as a hard 403 wall with no recovery — fixed to self-heal at the front
  door (`0aaebcf`). Brittle OAuth `state` exact-match that broke across retries with no way
  out — fixed with an httpOnly cookie (`77a7955`).
- **Pilot signal:** a state with no exit/recovery/alternative; a hard block (403/error) that
  doesn't offer a next step.
- **Pilot says:** "A user who lands here is trapped. Every dead-end needs a door — retry,
  delete, or a self-healing redirect."

### 8. Surprise walls — limits that hide until you hit them 🟠
- **Real cases:** the **3 free AI-plan limit** was invisible until you slammed into it (now
  surfaced up front: "3 AI plans — N left", `50866a0`). The delete-paywall appeared only
  *after* you tried.
- **Pilot signal:** a limit/quota/gate enforced server-side but never shown to the user before
  they hit it.
- **Pilot says:** "Surface this limit *before* the wall — show 'N of M left' at the point of
  use, and what happens at 0."

### 9. Hydration / determinism / perf — "the app feels frozen" 🟡→🔴
Not just a tech bug; it reads as the product being broken.
- **Real cases:** React **#418 hydration mismatch** — `toLocaleDateString()` rendered in UTC
  on the server and local time on the client → React threw away the HTML and re-rendered (fixed
  with a deterministic `formatDate`, `f3783f2`). **PostHog session-recording** kept the network
  busy so the page **never reached idle** → 30s "freeze" in automation.
- **Pilot signal:** non-deterministic values rendered during SSR (`Date`/locale/`Math.random`/
  `window` in render); a persistent connection/recorder that never lets the page settle.
- **Pilot says:** "This renders differently on the server vs the browser (a hydration mismatch)
  — pin it (fixed locale/UTC). And this analytics recorder keeps the page from ever going idle."

### 10. Orphaned / half-built features — built but wired nowhere 🟠
- **Real cases:** the **Vercel OAuth was fully built but linked to nothing** (the "1-click
  connect" that never worked). `archived_at` was added as a column but **never set or
  filtered** — a dead column for a whole release. A standalone notice card superseded by the
  checklist but left in.
- **Pilot signal:** code/columns/components with no caller, no writer, or no reader; a feature
  reachable in code but not from any UI path.
- **Pilot says:** "This is built but connected to nothing — either wire it up or delete it. A
  half-wired feature is a future 'why doesn't this work?'"

### 11. Regression from "lowering the wall" — a fix that quietly removes the product 🔴
- **Real case:** commit `e24460e` "GitHub-only provisioning, lower the wall" made Vercel/Supabase
  **optional** → users got a repo at status `ready` with **no live app**. The friction was
  "fixed" by removing the thing that delivered the value.
- **Pilot signal:** a change that makes a *value-critical* step optional/skippable; a "simplify"
  that drops a step the core promise depends on.
- **Pilot says:** "This removes friction by removing the deploy — users now get a repo but not a
  *live app*, which is the whole promise. Keep the step; make it smoother instead."

### 12. Tested-once, assumed-forever 🟠
- **Real case:** the provision flow was verified once on XP's account and assumed good; the
  *deploy actually landing* (commit-email, production target, real URL) was never re-verified on
  a fresh build until a tester found two builds that 404'd.
- **Pilot signal:** a critical path with one historical green check and no re-verification after
  related changes; "it worked before" reasoning.
- **Pilot says:** "This last passed N changes ago, and you've touched the deploy path since —
  re-run the *full* journey on a fresh build before trusting it."

---

## How this becomes Pilot

Each entry is a **check** to add to `lib/pilot/checks/`, prioritized by how often it bit and
how badly:
- **Tier 1 (ship these first — they broke the promise repeatedly):** #1 optimistic state,
  #2 deploy-prerequisite chain, #3 unsafe long-job shape, + the two blind-spots (A fresh-account,
  B unverified-correctness).
- **Tier 2 (trust/honesty):** #4 cross-surface consistency, #6 vanity numbers, #7 dead-ends,
  #8 surprise walls.
- **Tier 3 (quality):** #5 config drift (env-readiness, already started), #9 determinism/perf,
  #10 orphaned features, #11 value-removing simplifications, #12 stale verification.

**Design rule for every check (the lesson of the whole 20 days):** Pilot must produce
*falsifiable, plain-English* findings — never "this might be off." A non-programmer can act on
"your live URL returns 404 even though it says deployed — here's the one fix"; they cannot act
on a vibe. The output is always: **what's true, why it bites, and the single highest-leverage
fix** (the crew-tester verdict shape).

> The most valuable Pilot isn't the one that knows best-practices. It's the one that already
> watched *this exact thing* go wrong — and stops it the next time, for you and for everyone
> who builds after you.
