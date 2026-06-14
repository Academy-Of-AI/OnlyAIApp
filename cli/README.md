# onlyai-pilot

Run [OnlyAI](https://onlyaiapp.com) Pilot's guardrail checks inside Claude Code, Codex, or any
terminal. It reads your repo **locally** and sends only the rule-applicable files to the hosted
Pilot API, which flags known drift classes (optimistic state, hydration mismatches, unsafe
long-jobs, …) and returns the findings. Your code stays on your machine; the checks (and your
plan) live server-side.

Requires an OnlyAI **Pro** plan. Zero dependencies (Node 18+).

## Install

```
npm i -g onlyai-pilot
```

## Use

```
pilot login <token>     # get a token at onlyaiapp.com/settings → "Pilot in your terminal"
pilot check             # audit the current repo
pilot help
```

Tip: add a line to your project's `CLAUDE.md` / `AGENTS.md` — "before deploying, run `pilot check`" —
and your AI agent will run it for you.

Config is stored at `~/.onlyai/pilot.json`. Override the API base with `--api <url>` or `ONLYAI_API`.
