# Pilot Fleet Learning — design

How Pilot gets smarter from real use **without ever seeing anyone's code**. The
moat is the accumulated, curated catalog of drift patterns + aggregate fleet
signal — not a black-box model. Pure OS-as-SaaS: deterministic rules are the
floor (today), learning sits on top and only ever *proposes* — a human ships.

## The one principle
**Capture patterns of failure, never the raw data.** Raw code (file contents,
the offending source line, file paths, repo names, URLs) never leaves the user's
machine. What travels is a small, enum-only *fingerprint* of what happened. This
is enforced at the lowest rung: the wire payload has **no field that can hold
code or free text**, so a leak is structurally impossible — not merely policed.

## The shape
```
pilot check (on the user's machine)
   │  computes findings locally (deterministic rules)
   │  derives an ENUM-ONLY pattern  ──────────────► raw code stays local
   ▼
POST /api/pilot/v1  (gate + strict enum schema; rejects anything free-text)
   ▼
pilot_signals table   (metadata-only BY SCHEMA — no code column exists)
   ▼
aggregation job (cron)
   ├─ Loop A: sharpen EXISTING rules (precision/recall from outcomes)
   └─ Loop B: propose NEW drift classes (from the incident/feedback stream)
   ▼
AI proposes a rule change  ──►  human review queue  ──►  XP approves
   ▼
drift-rules.mjs  (the ONE source)  ──►  CLI + CI + product all get it next release
```

## What a "pattern" is (the entire payload)
Per finding, the CLI sends ONLY:
- `rule_id` — which of *our* rules fired (e.g. `optimistic-success-status`). Our own id.
- `drift_class`, `severity` — enums.
- `file_kind` — derived category: `route | component | lib | action | other`. **Not the path.**
- `outcome` — `new | persisted | fixed | suppressed` (see below). Enum.

Per check (run-level):
- `anon_repo_id` — a **salted hash** so we can correlate the *same* repo across
  runs (to compute outcomes) without knowing which repo it is. Salt lives
  server-side; the hash is one-way and carries no name/URL.
- `stack_tags[]` — coarse tags from the existing stack sniff (`nextjs`,
  `supabase`, `stripe`, …). Aggregate, low-sensitivity.
- `score`, `grade`, `files_scanned`, `findings_total` — numbers.

**Never sent (stays on the machine):** file contents, the `evidence` source line,
file paths, repo name / git remote / URL, env values, the user's identity beyond
the auth token already used for billing.

`outcome` is the gold signal, computed locally by diffing this run against the
last run of the same repo:
- a finding that's gone → `fixed` (the rule was *useful* → true positive),
- a finding now carrying `// pilot-lint-ok` → `suppressed` (likely *false positive*),
- still there → `persisted` (ignored / not yet actioned),
- not seen before → `new`.

## Guarantee placement (lowest enforceable rung)
| Guarantee | Pinned at |
|---|---|
| Raw code never leaves the machine | CLI computes the pattern locally; the wire payload has no code/free-text field |
| Server can't store code | `pilot_signals` has **no code column** (DB constraint) + API validates an enum-only zod schema at the boundary (rejects extras) |
| Repos can't be re-identified | only a server-salted one-way hash is sent — no path / URL / name fields exist |
| Consent is informed | default **on (opt-out)**, disclosed once on first run; `pilot config telemetry off` stops it; with it off the API still gates (billing) but no signal is sent |
| A bad rule can't hit everyone | human-approval gate; rules enter ONLY via `drift-rules.mjs` (the SSOT) — never auto-shipped |
| One ruleset everywhere | `drift-rules.mjs` is already the single source (CLI + CI + product), so a learned rule reaches all faces at once |

## The two loops
**Loop A — sharpen existing rules (safe, high-value, build first).**
From `pilot_signals` aggregates: a rule with a high `suppressed` rate is noisy
(tighten or retire it); a high `fixed` rate proves it's valuable (keep/raise it);
prevalence by `drift_class` shows what to prioritize. This makes Pilot *more
precise* with near-zero privacy surface — only our own rule ids + outcomes.

**Loop B — discover NEW drift classes (curated, build later).**
New classes do **not** come from scraping user code. They come from the
**incident stream you already have** — the "Report a problem" + diagnostic
screenshot loop, plus deploy-failure events — exactly how `PILOT_DRIFT_CATALOG.md`
was built (your scar tissue). An AI reads anonymized incident *descriptions*
(PII-stripped), proposes a candidate drift class + a draft rule, and a human
approves before it ships. "Learns from the fleet," with a human gate — not an
autonomous model rewriting itself in production.

## Consent
**On by default (opt-out)** — defensible precisely because what's shared is
anonymous *patterns*, never code. The first run **discloses once**: *"Pilot shares
anonymous failure patterns (which rule fired + the outcome) to improve — never
your code, file paths, or repo names. Turn it off anytime: `pilot config telemetry
off`."* The choice is recorded in `~/.onlyai`, so the notice shows only once.
Everything still works fully with it off — the deterministic rules don't depend
on the loop. (Tradeoff: opt-out maximises signal; the honesty rests entirely on
the disclosure + the by-construction guarantee that no code can be sent.)

## Phasing
- **Phase A (lightweight capture):** add `pilot_signals` (metadata-only) + the
  enum-only ingest on `pilot check` + consent prompt + an owner dashboard of
  rule precision/prevalence. Starts accumulating signal; sharpens rules. Small.
- **Phase B (new-class proposals):** AI-over-incidents → review queue → approve →
  `drift-rules.mjs`. Builds on the feedback infra already shipped.
- **Phase C (optional, heavier):** structural fingerprints (AST-shape tokens, not
  code) for richer pattern discovery — only if A/B prove insufficient; needs its
  own privacy review.

## Honest caveats
- **It needs a fleet.** With ~1 user there's nothing to aggregate. This is the
  right architecture to *design* now and to start *capturing* (Phase A) cheaply —
  but the payoff arrives once there are many users. Don't build the heavy
  aggregation/AI pipeline before the volume exists.
- **"Self-improving" is mostly Loop A** (precision), which is real and safe. Loop
  B (genuinely new classes) is curation-paced, not magic.
- **Trust is the real decision, not code.** Today Pilot stores *nothing* — a
  selling point. Capturing even anonymized patterns is a trust call; the
  enum-only-by-schema design + default-off consent is what keeps that trust.
