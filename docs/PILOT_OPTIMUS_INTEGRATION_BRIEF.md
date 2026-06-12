# Brief: route the Pilot's alerts to XP's Optimus agent (and/or Telegram)

A self-contained brief for a **fresh session** to build the OnlyAIApp side of
"Pilot notifications → Optimus / Telegram." Everything needed is here; the new
session will not have the originating conversation.

---

## Goal
Push owner-relevant events from the OnlyAIApp (vibe-launchpad) backend to XP's
personal **Optimus/Hermes agent** and/or his **Telegram**, so (a) XP gets pinged
on his phone and (b) his chief-of-staff agent gains live awareness of the
product's state. Start with the **feedback** event (already wired), then expand
to broken-build / drift / failed-deploy / DB-security findings.

Doctrine fit: deterministic Pilot checks at the base → the agent (Optimus)
orchestrates on top. The Pilot feeds facts; Optimus is the brain.

---

## ⚠️ FIRST: the open decision (ask XP before building the Optimus channel)
**How does Optimus/Hermes receive input?** This forks the design:

- **(A) HTTP webhook** — Optimus exposes an authenticated endpoint. → Pilot
  POSTs structured JSON to it with a shared secret. *Need from XP:* the URL +
  auth token. (Direct ping; no Telegram required.)
- **(B) Telegram shared bus** — Optimus reads a Telegram chat/group. → one
  platform Telegram bot posts into a group where BOTH XP and Optimus sit. One
  channel reaches XP's eyes AND the agent. *Need from XP:* bot token
  (@BotFather), the group `chat_id`, Optimus added to the group.
- **(C) Queue/DB poll** — Optimus polls a store. → Pilot writes events there.

The **Telegram channel (B) can be built immediately and generically** (env-gated,
ships dark) even before XP picks A/B/C — it's useful on its own (pings XP's
phone) and doubles as the shared bus if Optimus joins the group. Build that
first; wire the direct Optimus webhook (A) once XP supplies URL+token.

---

## Where things are (repo + infra)
- **Repo:** `C:\Users\ngxie\projects\vibe-launchpad` — Next.js 15 App Router,
  Supabase, Vercel. Prod domain **onlyaiapp.com**. Supabase prod ref
  **`mmwnmqewgpmzattaoymo`**.
- **Existing foundation — `lib/notify.ts`:** already has `notify(db,userId,…)`
  (in-app bell + optional Resend email) and **`notifyOwnerOfFeedback(admin,{…})`**
  — a best-effort, multi-channel owner notifier wired into
  `app/api/feedback/route.ts` after a successful feedback insert. Channels are
  **gated on env vars and ship DARK (no-op until set)**:
  - in-app bell → `FEEDBACK_NOTIFY_USER_ID`
  - email → `FEEDBACK_NOTIFY_EMAIL` (uses verified `noreply@${RESEND_FROM_DOMAIN}`)
- **Already set in Vercel prod:** `RESEND_API_KEY`, `RESEND_FROM_DOMAIN`.
- **Deploy:** `npx vercel --prod --yes` then `git push origin main`.
  **NEVER deploy without XP's explicit OK.** (Local commits are fine.)

---

## Build (Phase 1 — owner-level, env-gated, ships dark)
Add channel senders to `lib/notify.ts`, each best-effort / never-throws, each
gated on its own env (so nothing fires until configured):

1. **`notifyTelegram(text)`** — `POST https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
   with body `{ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }`.
   Gate: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.
2. **`notifyOptimus(event)`** — `POST ${OPTIMUS_WEBHOOK_URL}` with header
   `Authorization: Bearer ${OPTIMUS_TOKEN}`, body = structured JSON
   `{ type, title, body, source: "onlyaiapp-pilot", ts }`.
   Gate: `OPTIMUS_WEBHOOK_URL` + `OPTIMUS_TOKEN`. (Only build once XP confirms
   the endpoint exists — do NOT invent a URL; it must come from XP.)
3. **Fan-out:** extend `notifyOwnerOfFeedback` (or add a generic
   `notifyOwner(event)`) to call ALL configured channels (in-app, email,
   Telegram, Optimus). Keep each in its own try/catch — one channel failing must
   not affect the others or the originating request.

Then (optional, same PR) wire the same `notifyOwner` into other owner events:
- deploy failure → `app/api/projects/[id]/deploy-status/route.ts` (state ERROR)
- drift flagged → `app/api/projects/[id]/drift/route.ts`
Keep these additive + best-effort.

---

## Phase 2 (FUTURE — do not build now; note for roadmap)
Productize as a **Pro feature: "Pilot on Telegram," per-user.**
- ONE platform Telegram bot (`@OnlyAIAppBot`), not a bot per user.
- Each Pro user links it via Settings → deep-link `t.me/<bot>?start=<token>`; a
  bot webhook (`/api/telegram/webhook`) captures their `chat_id` and stores it on
  `profiles` (new column `telegram_chat_id`) matched to the start-token.
- Pilot events for that user's projects → their Telegram. **Pro-gated** (fits the
  "Full Pilot" line on the Pro tier).
- Same notify abstraction, just resolve the recipient's channel(s) from their
  profile instead of env. (A few hours to a day of work.)

---

## Constraints / QC
- Best-effort everywhere; **never block** the originating request.
- **Ship dark** — no behavior change until an env var is set.
- Only POST to an Optimus endpoint **XP supplied** (don't send user data to an
  endpoint from anywhere else).
- Before deploy: `node scripts/pilot-lint.mjs` clean · `npx tsc --noEmit` green ·
  `npx next build` green. Run a crew-tester pass. Then deploy only on XP's OK.
- After turning on a channel, verify by triggering one real event (e.g. file a
  test "Report a problem") and confirming the ping lands.

---

## What to ask XP at the start of that session
1. How does Optimus/Hermes listen — **(A) webhook URL+token, (B) Telegram group,
   (C) queue/DB**? And the concrete values (URL/token, or bot token + group
   chat_id).
2. OK to build the **generic Telegram channel now** (env-gated, dark) so it's
   ready the moment he sets the vars?
