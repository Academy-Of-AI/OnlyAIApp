#!/usr/bin/env node
/**
 * launchpad — local CLI for the Launchpad control plane.
 *
 * Captures your most recent Claude Code session + uncommitted WIP and pushes
 * them to the control plane, which extracts memory, advances milestones, and
 * checks drift — then re-syncs CLAUDE.md. This is the live-session capture that
 * commit-only auto-capture can't see.
 *
 * Setup: create `.launchpad.json` in your repo root:
 *   { "apiUrl": "https://vibe-launchpad-two.vercel.app", "projectId": "<uuid>", "token": "lp_..." }
 * (Generate the token in the project page → Auto-capture → "CLI token".)
 *
 * Usage:
 *   node launchpad.mjs sync     # push latest session + WIP
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function loadConfig() {
  const path = join(process.cwd(), ".launchpad.json");
  if (!existsSync(path)) {
    console.error("Missing .launchpad.json in the current directory.");
    console.error('Create it: { "apiUrl": "...", "projectId": "...", "token": "lp_..." }');
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

/** Find the newest Claude Code session transcript for the current repo. */
function latestSession() {
  const base = join(homedir(), ".claude", "projects");
  if (!existsSync(base)) return "";
  // Claude Code stores per-project dirs; pick the most recently modified jsonl
  let newest = null;
  for (const dir of readdirSync(base)) {
    const full = join(base, dir);
    try {
      for (const f of readdirSync(full)) {
        if (!f.endsWith(".jsonl")) continue;
        const p = join(full, f);
        const m = statSync(p).mtimeMs;
        if (!newest || m > newest.m) newest = { p, m };
      }
    } catch { /* skip */ }
  }
  if (!newest) return "";
  // Extract the last ~40 text messages
  const lines = readFileSync(newest.p, "utf-8").trim().split("\n").slice(-120);
  const out = [];
  for (const line of lines) {
    try {
      const o = JSON.parse(line);
      const text = o?.message?.content?.[0]?.text ?? o?.text ?? "";
      const role = o?.message?.role ?? o?.role ?? "";
      if (text && (role === "user" || role === "assistant")) {
        out.push(`${role}: ${String(text).slice(0, 400)}`);
      }
    } catch { /* skip */ }
  }
  return out.slice(-40).join("\n");
}

function gitWip() {
  try {
    const status = execSync("git status --short", { encoding: "utf-8" }).trim();
    const stat = execSync("git diff --stat", { encoding: "utf-8" }).trim();
    return [status, stat].filter(Boolean).join("\n").slice(0, 2000);
  } catch { return ""; }
}

async function sync() {
  const cfg = loadConfig();
  const sessionText = latestSession();
  const wip = gitWip();
  if (!sessionText && !wip) { console.log("Nothing to sync."); return; }

  const res = await fetch(`${cfg.apiUrl}/api/projects/${cfg.projectId}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-launchpad-token": cfg.token },
    body: JSON.stringify({ sessionText, wip }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { console.error("Sync failed:", data.error ?? res.status); process.exit(1); }
  console.log("Synced session + WIP to Launchpad. Memory, milestones, and drift updated.");
}

const cmd = process.argv[2];
if (cmd === "sync") sync();
else { console.log("Usage: node launchpad.mjs sync"); }
