#!/usr/bin/env node
/**
 * pilot — OnlyAI's guardrail CLI. Runs in Claude Code, Codex, Cursor, a terminal,
 * or CI. It runs the drift checks **locally** — your code never leaves your
 * machine — and reports only an anonymous failure fingerprint (which rule fired +
 * outcome, never code/paths) for fleet learning. See docs/PILOT_FLEET_LEARNING.md.
 *
 *   pilot login <token> [--api <url>]    save + verify your OnlyAI Pro token
 *   pilot check [path]                   audit a repo locally (reports a pattern)
 *   pilot config telemetry on|off        opt in/out of anonymous fleet learning
 *   pilot help
 *
 * Config: ~/.onlyai/pilot.json  ({ token, api, telemetry }). Telemetry default ON
 * (opt-out) — anonymous patterns only, disclosed on first run; `pilot config
 * telemetry off` to disable.
 * Zero runtime dependencies (Node 18+). The rule engine is bundled as engine.mjs.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { auditFiles, healthScore, grade } from "./engine.mjs";

const DEFAULT_API = "https://onlyaiapp.com";
const CONFIG_DIR = join(homedir(), ".onlyai");
const CONFIG_PATH = join(CONFIG_DIR, "pilot.json");
const REPOS_DIR = join(CONFIG_DIR, "repos");
const MAX_FILES = 200;
const MAX_FILE_BYTES = 64_000;

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const positional = (n) => argv.slice(1).filter((a) => !a.startsWith("--"))[n];

const readJSON = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const loadConfig = () => readJSON(CONFIG_PATH) || {};
const saveConfig = (c) => { mkdirSync(CONFIG_DIR, { recursive: true }); writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2), { mode: 0o600 }); };
const apiBase = () => (flag("api") || process.env.ONLYAI_API || loadConfig().api || DEFAULT_API).replace(/\/+$/, "");

const C = { dim: "\x1b[2m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", bold: "\x1b[1m", reset: "\x1b[0m" };
const col = (c, s) => `${C[c]}${s}${C.reset}`;

// ── local file collection (a privacy filter; nothing here is ever sent) ──────
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", ".vercel", "coverage", ".turbo"]);
const CODE_RE = /\.(tsx|ts|jsx|js)$/;
const TOP_DIRS = new Set(["app", "src", "pages", "components", "lib"]);

function walk(root) {
  const out = [];
  const visit = (dir) => {
    let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP.has(e.name)) visit(full); }
      else if (CODE_RE.test(e.name)) out.push(full);
    }
  };
  for (const d of TOP_DIRS) { const p = join(root, d); if (existsSync(p)) visit(p); }
  return out;
}
function collectFiles(root) {
  const files = [];
  for (const full of walk(root)) {
    if (files.length >= MAX_FILES) break;
    try {
      if (statSync(full).size > MAX_FILE_BYTES) continue;
      files.push({ path: relative(root, full).split(sep).join("/"), content: readFileSync(full, "utf8") });
    } catch { /* skip unreadable */ }
  }
  return files;
}

// ── pattern derivation (the ONLY thing that leaves the machine) ──────────────
function fileKind(p) {
  if (/(^|\/)actions\.(ts|js)$/.test(p)) return "action";
  if (/(^app\/api\/.*route\.(ts|js)$)|(^pages\/api\/)/.test(p)) return "route";
  if (/\.(tsx|jsx)$/.test(p)) return "component";
  if (/(^|\/)lib\//.test(p)) return "lib";
  return "other";
}
function anonRepoId(root) { return createHash("sha256").update(root).digest("hex").slice(0, 16); }
function stackTags(root) {
  const pkg = readJSON(join(root, "package.json"));
  if (!pkg) return [];
  const deps = JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies } || {});
  const tags = [];
  const has = (re) => re.test(deps);
  if (has(/"next"/)) tags.push("nextjs");
  if (has(/@supabase/)) tags.push("supabase");
  if (has(/"stripe"/)) tags.push("stripe");
  if (has(/@anthropic-ai|"openai"/)) tags.push("ai");
  if (has(/tailwind/)) tags.push("tailwind");
  return tags;
}

async function call(method, path, body) {
  const token = loadConfig().token;
  if (!token) { console.error(col("red", "Not logged in.") + " Run: pilot login <token>   (get one at onlyaiapp.com/settings)"); process.exit(1); }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined, signal: controller.signal,
    });
    return { res, data: await res.json().catch(() => ({})) };
  } catch (e) {
    if (e?.name === "AbortError") { console.error(col("red", "Pilot timed out — try again.")); process.exit(1); }
    console.error(col("red", "Couldn't reach Pilot: ") + (e?.message ?? e)); process.exit(1);
  } finally { clearTimeout(timer); }
}

// ── commands ─────────────────────────────────────────────────────────────
async function login() {
  const token = positional(0);
  if (!token) { console.error("Usage: pilot login <token> [--api <url>]"); process.exit(1); }
  saveConfig({ ...loadConfig(), token: token.trim(), api: apiBase() });
  const { res, data } = await call("GET", "/api/pilot/v1");
  if (!res.ok) { console.error(col("red", "Login failed: ") + (data.error || res.status)); process.exit(1); }
  console.log(col("green", "✓ Connected to Pilot") + col("dim", ` (${apiBase()})`));
  if (data.usage) console.log(col("dim", `  ${data.usage.remaining} of ${data.usage.limit} Pilot runs left this month`));
}

async function check() {
  const root = positional(0) ? join(process.cwd(), positional(0)) : process.cwd();
  const cfg = loadConfig();
  const files = collectFiles(root);
  if (!files.length) { console.error(col("yellow", "No code files found to scan here.")); process.exit(1); }

  // The checks run HERE — code never leaves the machine.
  const findings = auditFiles(files);
  const score = healthScore(findings);
  const g = grade(score);

  // Outcome vs the last local run (new | persisted). file/line stay local.
  const id = anonRepoId(root);
  const sigPath = join(REPOS_DIR, `${id}.json`);
  const prev = new Set((readJSON(sigPath)?.sigs) || []);
  const sigOf = (f) => `${f.ruleId}:${f.file}`;

  // Fleet learning is opt-OUT (default ON) — anonymous patterns only, never code.
  // Disclose ONCE on first run, then record the choice so it doesn't repeat.
  let telemetry = cfg.telemetry;
  if (telemetry === undefined) {
    telemetry = "on";
    saveConfig({ ...cfg, telemetry });
    console.log(col("dim", "ℹ Pilot shares anonymous failure patterns (which rule fired + the outcome) to improve — never your code, file paths, or repo names. Turn it off anytime: pilot config telemetry off"));
  }
  const telemetryOn = telemetry !== "off";

  // Enum-only report. Per-finding detail is included ONLY with consent; without
  // it we still call the API (entitlement/billing) but send no signal.
  const report = {
    anonRepoId: id,
    score, grade: g, findingsTotal: findings.length,
    stackTags: stackTags(root),
    findings: telemetryOn ? findings.map((f) => ({
      ruleId: f.ruleId, drift: f.drift, severity: f.severity,
      fileKind: fileKind(f.file),
      outcome: prev.has(sigOf(f)) ? "persisted" : "new",
    })) : [],
  };
  const { res, data } = await call("POST", "/api/pilot/v1", { tool: "report", input: report });
  if (!res.ok) { console.error("\n" + col("red", "Pilot: ") + (data.error || res.status)); process.exit(1); }

  // Remember this run's signatures for next time's outcome.
  try { mkdirSync(REPOS_DIR, { recursive: true }); writeFileSync(sigPath, JSON.stringify({ sigs: findings.map(sigOf) })); } catch { /* non-fatal */ }

  // Local display (full detail — this stays on your screen).
  const gc = g === "A" || g === "B" ? "green" : g === "C" ? "yellow" : "red";
  console.log(`\n${col("bold", "Pilot health read")}  ${col(gc, `${g}  ${score}/100`)}  ${col("dim", `· ${files.length} files · ${findings.length} findings`)}\n`);
  const tag = { high: col("red", "HIGH "), medium: col("yellow", "MED  "), low: col("dim", "LOW  ") };
  for (const f of findings) {
    console.log(`${tag[f.severity]} ${col("bold", f.title)}  ${col("dim", f.drift)}`);
    console.log(`      ${col("dim", `${f.file}:${f.line}`)}  ${f.evidence}`);
    console.log(`      ${col("green", "fix:")} ${f.fix}\n`);
  }
  if (!findings.length) console.log(col("green", "Clean — no known drift classes found.\n"));
  if (data.usage) console.log(col("dim", `${data.usage.remaining} of ${data.usage.limit} Pilot runs left this month`));
}

function config() {
  const key = positional(0), val = positional(1);
  if (key === "telemetry" && (val === "on" || val === "off")) {
    saveConfig({ ...loadConfig(), telemetry: val });
    console.log(col("green", `✓ Fleet learning ${val}.`) + (val === "on" ? col("dim", " (anonymous patterns only — never your code)") : ""));
    return;
  }
  console.log("Usage: pilot config telemetry on|off");
  console.log(`Currently: telemetry ${loadConfig().telemetry ?? "on (default)"}`);
}

function help() {
  console.log(`${col("bold", "pilot")} — OnlyAI guardrail CLI

  pilot login <token> [--api <url>]    Save + verify your OnlyAI Pro token
  pilot check [path]                   Audit a repo for drift (runs locally)
  pilot config telemetry on|off        Opt in/out of anonymous fleet learning
  pilot help

Your code never leaves your machine — checks run locally; only anonymous
patterns are reported (with consent). Get a token at onlyaiapp.com/settings.`);
}

const run = { login, check, config, help, "--help": help, "-h": help };
Promise.resolve((run[cmd] || help)()).catch((e) => { console.error(col("red", String(e?.message ?? e))); process.exit(1); });
