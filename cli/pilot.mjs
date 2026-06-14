#!/usr/bin/env node
/**
 * pilot — OnlyAI's guardrail CLI. The universal face of the Pilot API: it runs in
 * Claude Code, Codex, Cursor, a plain terminal, or CI (anything that can run a
 * shell command). It reads your repo LOCALLY and sends only the rule-applicable
 * files to the hosted API, which runs the checks (the rules — the moat — stay
 * server-side) and returns findings. Auth is a Pro token; billing is continuous.
 *
 * Zero dependencies (Node 18+ built-ins only) so it installs anywhere.
 *
 *   pilot login <token> [--api <url>]   save + verify your OnlyAI Pro token
 *   pilot check [path]   [--api <url>]   audit a repo for known drift classes
 *   pilot help
 *
 * Config: ~/.onlyai/pilot.json  ({ token, api }).  Env override: ONLYAI_API.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, sep } from "node:path";

const DEFAULT_API = "https://onlyaiapp.com";
const CONFIG_DIR = join(homedir(), ".onlyai");
const CONFIG_PATH = join(CONFIG_DIR, "pilot.json");
const MAX_FILES = 80;
const MAX_FILE_BYTES = 64_000;

// ── tiny arg parsing ──────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const cmd = argv[0];
function flag(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
function positional(n) {
  return argv.slice(1).filter((a) => !a.startsWith("--"))[n];
}

function loadConfig() {
  try { return JSON.parse(readFileSync(CONFIG_PATH, "utf8")); } catch { return {}; }
}
function apiBase() {
  return (flag("api") || process.env.ONLYAI_API || loadConfig().api || DEFAULT_API).replace(/\/+$/, "");
}

const C = { dim: "\x1b[2m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", bold: "\x1b[1m", reset: "\x1b[0m" };
const col = (c, s) => `${C[c]}${s}${C.reset}`;

// ── file collection (a privacy filter, NOT business logic) ────────────────
// Mirrors which files the server rules can apply to, so we never ship the whole
// repo — only code files where drift can live, prioritised, capped.
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", ".vercel", "coverage", ".turbo"]);
const CODE_RE = /\.(tsx|ts|jsx|js)$/;
const TOP_DIRS = new Set(["app", "src", "pages", "components", "lib"]);

function walk(root) {
  const out = [];
  const visit = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".env.example") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) visit(full); }
      else if (CODE_RE.test(e.name)) out.push(full);
    }
  };
  // Only descend the dirs where the rules fire (keeps the payload small + private).
  for (const d of TOP_DIRS) { const p = join(root, d); if (existsSync(p)) visit(p); }
  return out;
}

function priority(rel) {
  if (/route\.(ts|js)$/.test(rel) || /actions\.(ts|js)$/.test(rel)) return 0; // #1/#3 live here
  if (/\.(tsx|jsx)$/.test(rel)) return 1;                                      // #9 lives here
  return 2;
}

function collectFiles(root) {
  const picked = walk(root)
    .map((full) => ({ full, rel: relative(root, full).split(sep).join("/") }))
    .sort((a, b) => priority(a.rel) - priority(b.rel) || a.rel.length - b.rel.length);
  const files = [];
  for (const { full, rel } of picked) {
    if (files.length >= MAX_FILES) break;
    try {
      if (statSync(full).size > MAX_FILE_BYTES) continue;
      files.push({ path: rel, content: readFileSync(full, "utf8") });
    } catch { /* unreadable — skip */ }
  }
  return files;
}

// ── HTTP ──────────────────────────────────────────────────────────────────
async function call(method, path, body) {
  const token = loadConfig().token;
  if (!token) {
    console.error(col("red", "Not logged in.") + " Run: pilot login <token>   (get a token at onlyaiapp.com/settings)");
    process.exit(1);
  }
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    console.error(col("red", "Couldn't reach Pilot: ") + (e?.message ?? e));
    process.exit(1);
  }
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// ── commands ────────────────────────────────────────────────────────────
async function login() {
  const token = positional(0);
  if (!token) { console.error("Usage: pilot login <token> [--api <url>]"); process.exit(1); }
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ token: token.trim(), api: apiBase() }, null, 2), { mode: 0o600 });
  const { res, data } = await call("GET", "/api/pilot/v1");
  if (!res.ok) { console.error(col("red", `Login failed: `) + (data.error || res.status)); process.exit(1); }
  console.log(col("green", "✓ Connected to Pilot") + col("dim", ` (${apiBase()})`));
  if (data.usage) console.log(col("dim", `  ${data.usage.remaining} of ${data.usage.limit} Pilot runs left this month`));
}

async function check() {
  const root = positional(0) ? join(process.cwd(), positional(0)) : process.cwd();
  const files = collectFiles(root);
  if (!files.length) { console.error(col("yellow", "No code files found to scan here.")); process.exit(1); }
  process.stdout.write(col("dim", `Scanning ${files.length} files…\r`));
  const { res, data } = await call("POST", "/api/pilot/v1", { tool: "drift_check", input: { files } });
  if (!res.ok) { console.error("\n" + col("red", "Pilot: ") + (data.error || res.status)); process.exit(1); }

  const { score, grade: g, counts, findings, filesScanned } = data.result;
  const gradeColor = g === "A" ? "green" : g === "B" ? "green" : g === "C" ? "yellow" : "red";
  console.log(`\n${col("bold", "Pilot health read")}  ${col(gradeColor, `${g}  ${score}/100`)}  ${col("dim", `· ${filesScanned} files · ${counts.total} findings`)}\n`);

  const sevTag = { high: col("red", "HIGH "), medium: col("yellow", "MED  "), low: col("dim", "LOW  ") };
  for (const f of findings) {
    console.log(`${sevTag[f.severity]} ${col("bold", f.title)}  ${col("dim", f.drift)}`);
    console.log(`      ${col("dim", `${f.file}:${f.line}`)}  ${f.evidence}`);
    console.log(`      ${col("green", "fix:")} ${f.fix}\n`);
  }
  if (!findings.length) console.log(col("green", "Clean — no known drift classes found.\n"));
  if (data.usage) console.log(col("dim", `${data.usage.remaining} of ${data.usage.limit} Pilot runs left this month`));
}

function help() {
  console.log(`${col("bold", "pilot")} — OnlyAI guardrail CLI

  pilot login <token> [--api <url>]   Save + verify your OnlyAI Pro token
  pilot check [path]   [--api <url>]   Audit a repo for known drift classes
  pilot help

Get a token at onlyaiapp.com/settings. Config: ~/.onlyai/pilot.json`);
}

const run = { login, check, help, "--help": help, "-h": help };
// Promise.resolve wraps BOTH sync commands (help) and async ones (login/check) —
// calling .catch directly on help's undefined return crashed the help path.
Promise.resolve((run[cmd] || help)()).catch((e) => { console.error(col("red", String(e?.message ?? e))); process.exit(1); });
