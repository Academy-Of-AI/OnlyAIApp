import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { friendlyAiError } from "@/lib/ai-errors";
import { runMigration } from "@/lib/supabase-mgmt";
import { getCommitIdentity } from "@/lib/github";

export const maxDuration = 300;

const PLAN_MODEL = process.env.BUILD_MODEL ?? "claude-sonnet-4-5";

/**
 * POST /api/projects/:id/plan-pack
 * Turns the builder's idea into the AI-App-Building-OS methodology pack — a set
 * of /docs files (PRD, ARCHITECTURE, DATA_MODEL, INTELLIGENCE_LAYER,
 * AGENTIC_LAYER, TASKS/sprints, SECURITY, TEST_PLAN) plus a CLAUDE.md that
 * points the agent at them — committed to the repo in ONE atomic commit, ready
 * to hand off to Claude Code / Codex. Streams SSE progress.
 *
 * Power-user path ("bring your own docs"): the client may also pass
 *   - docs: [{ name, content, kind: "prd" | "skill" }]  — the builder's own files
 *   - mode: "ground_truth" | "skip"
 * "ground_truth" feeds the docs to the generator as the source of truth (the
 * pack is grounded in them). "skip" does NOT regenerate the planning docs — it
 * commits the docs verbatim and only derives the database schema from them (so
 * the DB-first promise still holds). In both cases skill docs go to
 * `.claude/skills/` so the coding agent uses them directly.
 */

/* The proprietary method, condensed from ai_app_building_os_knowledgebase.md.
   This is what makes the pack ours, not generic. */
const OS_METHOD = `You generate planning docs using the "AI App Building OS" method. Encode it faithfully.

CORE BELIEF: We don't vibe-code random apps. We build products that evolve from messy
business input into structured data, prioritized work, and safe agentic action.

TWO MODELS (always apply both):
- Maturity ladder: Database -> Dashboard -> Recommendation -> Agentic Action.
  (Place the v1 MVP on the ladder; show what is v1 vs later.)
- Runtime loop: Capture -> Structure -> Store -> Show -> Rank -> Act -> Learn.
  (Describe how ONE real user action flows through the system.)

DOCTRINE: DB-first -> coded logic -> intelligence on top. The core must run even with
the AI switched off. Define objects + fields + actions + rules + views + users first.
Do NOT start with code.

DATA: For any AI-generated field, store value + source + confidence + review_status.
Core tables: users, teams, memberships, app objects, activities, audit_logs.

AGENTIC RISK LEVELS: low = auto (summarise/tag/score/draft); medium = light approval
(create task/update status); high = always approval (send message/charge); critical =
human-only (delete/refund/legal). Recommendation -> Draft -> Approval -> Action -> Audit.

SECURITY: never expose secrets in frontend; agent inherits the user's permissions;
approved named tools only (never raw run_any/send_any); log every meaningful action.

DEFINITION OF DONE: works in preview; handles empty/error/loading; follows permissions;
no secrets exposed; writes correct data; has test steps; clear UI copy; documented; committed.

SCOPE NOTE: this is a personal/internal OS for the builder + their agent to deliver their
own expertise — NOT a multi-tenant SaaS for resale, unless the idea explicitly says so.
Keep v1 ruthlessly small. Put everything else in non-goals or later phases.

OUTPUT RULE (critical): use this thinking to STRUCTURE the docs, but NEVER name or quote the
method in what you write. Do NOT use the phrases "Maturity Ladder", "Capture -> Structure ->
Store -> Show -> Rank -> Act -> Learn", "runtime loop", "intelligence layer ladder", or
"AI App Building OS", and do not refer to "the method / framework / doctrine". Show
sequencing as Now / Next / Later in the app's own feature terms; describe data flow as plain
concrete steps for THIS app. The method is our private engine — it must stay invisible in the
delivered docs, which should simply read as an unusually clear, well-sequenced plan.`;

const DOC_SPECS = `Produce these files (path -> required content). Be SPECIFIC to the idea — real object
names, real fields, real copy. No "TODO"/"Lorem"/"Feature 1".

BREVITY IS CRITICAL (this must finish fast): keep each doc TIGHT — PRD <= 300 words,
every other doc <= 200 words. Terse bullets, not prose. The whole pack should be a sharp
brief an agent can act on, not an essay.

docs/PRD.md — Problem; Target user; Core objects; MVP (v1) as a checklist of must-haves;
  Non-goals (v1); Success criteria (one concrete end-to-end scenario).
docs/ARCHITECTURE.md — Stack (Next.js + Supabase + Vercel); what to build now vs later (in the
  app's own feature terms); the step-by-step flow of the key user action; the layer plan
  (data first, then app logic, then smart features); why the core runs without the AI.
docs/DATA_MODEL.md — Each object: fields (name:type), relationships, RLS/permission notes.
  Note value+source+confidence+review_status for any AI fields.
docs/INTELLIGENCE_LAYER.md — Messy inputs; auto-structure schema (JSON example); events to
  track; scoring rules (start rule-based, give numbers); what gets ranked; v1 vs later.
docs/AGENTIC_LAYER.md — Draftable actions; executable-after-approval actions; human-only
  actions; named tools; audit-log fields; v1 vs later, tagged by risk level.
docs/SECURITY.md — Secret handling; permission model; approved-tools rule; audit principle.
docs/TASKS.md — Sprints 1..N. Each sprint: goal + a checklist of tasks + its Definition of
  Done. Order them so the DB + core CRUD come first, intelligence/agentic later. Include a
  simple text Gantt (which sprint each task lands in).
docs/TEST_PLAN.md — Manual test steps for the v1 success scenario + empty/error cases.

ALSO fill (for the UI, de-branded, the app's own words):
- plan: now / next / later — short bullets a non-technical owner understands.
- sprints: the same sprints as docs/TASKS.md, as {title, items[]}, ordered.
- migration_sql: the executable SQL for docs/DATA_MODEL.md (see the tool field for exact rules).
  It will be applied to a live database, so it must create EVERY object in DATA_MODEL.md, with RLS
  + owner policies, and be idempotent (safe to re-run). DATA_MODEL.md and migration_sql must agree.`;

/* The exact, hard-won rules for the migration SQL — shared by the full-pack tool
   and the "bring your own docs" schema-only tool so a live DB is set up the same
   safe way regardless of path. */
const MIGRATION_RULES =
  "Executable Postgres/Supabase DDL that creates EXACTLY the app's domain schema for THIS app — " +
  "nothing more. It will be applied to a live Supabase project, so it must run clean and be safe " +
  "to re-run. Rules: (1) only this app's domain tables — do NOT create or alter auth.users, " +
  "profiles, billing, or any platform tables. (2) Every table: `create table if not exists`, an " +
  "`id uuid primary key default gen_random_uuid()`, an owner column `user_id uuid not null " +
  "references auth.users(id) on delete cascade`, and `created_at timestamptz not null default " +
  "now()`. (3) For any AI-generated field add value + `source text` + `confidence numeric` + " +
  "`review_status text default 'unreviewed'` columns. (4) Enable RLS on every table (`alter table " +
  "<t> enable row level security;`) and add owner-scoped policies using `auth.uid() = user_id`; " +
  "make each policy idempotent by writing `drop policy if exists \"<name>\" on <table>;` immediately " +
  "before its `create policy`. (5) No seed data, no comments, no BEGIN/COMMIT. Plain DDL only.";

const WRITE_DOCS_TOOL: Anthropic.Tool = {
  name: "write_docs",
  description: "Write the methodology planning docs for the project.",
  input_schema: {
    type: "object",
    properties: {
      files: {
        type: "array",
        description: "The doc files to create. One entry per docs/*.md file.",
        items: {
          type: "object",
          properties: {
            path: { type: "string", description: "e.g. docs/PRD.md" },
            content: { type: "string", description: "Full markdown content." },
          },
          required: ["path", "content"],
        },
      },
      summary: { type: "string", description: "One-line summary of the app for CLAUDE.md." },
      plan: {
        type: "object",
        description: "Build sequencing in the app's OWN feature words (de-branded). Short bullet strings.",
        properties: {
          now: { type: "array", items: { type: "string" }, description: "What to build now (v1)." },
          next: { type: "array", items: { type: "string" }, description: "What to add soon after v1." },
          later: { type: "array", items: { type: "string" }, description: "What to add later." },
        },
      },
      sprints: {
        type: "array",
        description: "Ordered sprints matching docs/TASKS.md. Each: a short title + a few task items.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            items: { type: "array", items: { type: "string" } },
          },
          required: ["title", "items"],
        },
      },
      migration_sql: { type: "string", description: MIGRATION_RULES },
    },
    required: ["files"],
  },
};

/* Schema-only tool for the "skip planning" path: the builder already wrote their
   plan, so we don't regenerate docs — we only derive the database (DB-first must
   still hold) plus a tiny summary + sequence for the UI. */
const SEED_FROM_DOCS_TOOL: Anthropic.Tool = {
  name: "seed_from_docs",
  description: "Derive the database schema + a short build sequence from the builder's existing docs. Do NOT rewrite their docs.",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "One-line summary of the app for CLAUDE.md." },
      plan: {
        type: "object",
        description: "Build sequencing in the app's OWN feature words. Short bullet strings.",
        properties: {
          now: { type: "array", items: { type: "string" } },
          next: { type: "array", items: { type: "string" } },
          later: { type: "array", items: { type: "string" } },
        },
      },
      migration_sql: { type: "string", description: MIGRATION_RULES },
    },
    required: ["migration_sql"],
  },
};

type InDoc = { name: string; content: string; kind: "prd" | "skill" };

// Keep a doc to a safe repo path: basename only, conservative charset, .md default.
function safeDocName(name: string): string {
  let base = (name.split(/[\\/]/).pop() || "doc").trim();
  base = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!/\.(md|markdown|txt)$/i.test(base)) base += ".md";
  return base;
}

// Cap a doc when feeding the model (we still commit the full original to the repo).
function truncForPrompt(s: string): string {
  return s.length > 12000 ? s.slice(0, 12000) + "\n…[truncated for planning]" : s;
}

function claudeMd(
  projectName: string,
  summary: string,
  docPaths: string[],
  schema: { hasMigration: boolean; applied: boolean },
  extra?: { ownDocs?: boolean; skillFiles?: string[]; commit?: { email: string; name: string } | null },
): string {
  const list = docPaths.length
    ? docPaths.map((p) => `- \`${p}\``).join("\n")
    : "- `/docs` (your provided specs)";

  // The data bullet adapts to what actually happened to the database, so the
  // agent never re-creates tables that already exist (or assumes none do).
  const dataBullet = schema.applied
    ? `- **Your database is already set up.** The schema from your data model has been applied to
  this project's Supabase database and committed at \`supabase/migrations/0001_init.sql\`. Build on
  the existing tables — **do not recreate them**. To change the schema, add a NEW migration file
  (\`supabase/migrations/0002_*.sql\`) and apply it; never edit \`0001\`.`
    : schema.hasMigration
      ? `- **Database-first:** the schema is written at \`supabase/migrations/0001_init.sql\` but **not yet
  applied**. Apply it to this project's Supabase database BEFORE building features (e.g. paste it into
  the Supabase SQL editor, or \`supabase db push\`). Don't build local-only / in-memory.`
      : `- **Database-first:** turn your data model into a Supabase migration and apply it BEFORE
  building features. Do not build local-only / in-memory.`;

  // Rule 1 differs when the builder brought their own docs (we don't generate a
  // canonical PRD.md/DATA_MODEL.md path set in that case).
  const rule1 = extra?.ownDocs
    ? "**Read first:** open everything in `/docs` — these are the specs the builder wrote — before writing a single line."
    : "**Read first:** open `docs/PRD.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`, and\n   `docs/TASKS.md` before writing a single line.";

  const skillBullet = extra?.skillFiles?.length
    ? `\n- **Your skill specs** are in \`.claude/skills/\` (${extra.skillFiles.join(", ")}). Treat them as
  binding instructions for how to build/behave — follow them.`
    : "";

  // Without this, Vercel blocks the deploy: "commit email could not be matched to
  // a GitHub account." Pin the repo's commit identity to a GitHub-matched email.
  const commitBullet = extra?.commit
    ? `\n- **Commit as your GitHub identity, or Vercel will block the deploy.** Vercel verifies that
  every commit's author email belongs to your GitHub account. Your machine's default git email
  often isn't, so the very first local commit gets rejected. Pin this repo's identity once
  (already correct for your account) — before your first commit:
  \`\`\`
  git config user.email "${extra.commit.email}"
  git config user.name "${extra.commit.name}"
  \`\`\``
    : "";

  return `# ${projectName}

${summary}

## ⚠️ READ THIS BEFORE WRITING ANY CODE
A complete, correct plan for this app is already committed in \`/docs\`. Do **not** start
from the project name, the summary above, or your own assumptions — those will lead you to
build the wrong thing (e.g. a marketing landing page). Open the plan and build from it:

${list}

## Build rules (binding — follow in order)
1. ${rule1}
2. **Confirm the plan** back to me in 2–3 lines (objects, Sprint 1 scope) BEFORE coding.
3. **Build the first slice from the docs only**, then stop for review. Nothing outside the plan.
4. **Database-first:** create the data model + core CRUD before any styling/polish. The core
   must work with the AI switched off.
5. **This is the real working app** — dashboards, records, forms, the flows in the plan.
   Do **NOT** build a marketing/landing page or a front-end-only demo.
6. Never put secrets in frontend code.${skillBullet}

## Deploy & data (binding — this stack is already provisioned)
- **Deploy by git, never by CLI.** \`git add -A && git commit -m "…" && git push\` to \`main\`;
  Vercel auto-deploys from GitHub. Do NOT run \`vercel deploy\` / \`vercel --prod\` with local
  files — it desyncs git, and the next push silently overwrites your live app.
- **Commit + push every change.** Git is the source of truth; uncommitted work is lost on
  the next deploy.
- **The Supabase database is already provisioned** and its keys are in this project's Vercel
  env. Pull them locally: \`vercel link\` then \`vercel env pull .env.local\`. Don't invent new ones.
${dataBullet}${commitBullet}

Kickoff prompt: "Read everything in /docs, confirm the plan in 3 lines, then build the first
slice — the database schema is already applied (pull env with vercel env pull and build on
the existing tables), commit + push to deploy, the real working app, not a landing page."
`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    idea?: string;
    docs?: Array<{ name?: unknown; content?: unknown; kind?: unknown }>;
    mode?: unknown;
  };
  const ideaOverride = typeof body?.idea === "string" && body.idea.trim() ? body.idea.trim() : null;

  // Power-user "bring your own docs" payload (optional).
  const docsInput: InDoc[] = (Array.isArray(body?.docs) ? body!.docs! : [])
    .filter((d) => d && typeof d.name === "string" && typeof d.content === "string" && (d.content as string).trim().length > 0)
    .slice(0, 8)
    .map((d) => ({
      name: String(d.name),
      content: String(d.content),
      kind: d.kind === "skill" ? "skill" : "prd",
    }));
  const mode: "none" | "ground_truth" | "skip" =
    body?.mode === "skip" ? "skip" : docsInput.length > 0 ? "ground_truth" : "none";

  const prdDocs = docsInput.filter((d) => d.kind !== "skill");
  const skillDocs = docsInput.filter((d) => d.kind === "skill");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerFunded = process.env.OWNER_FUNDED_BUILDS === "true";
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_SECRET_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "AI not configured — add ANTHROPIC_API_KEY to your Vercel environment variables." },
      { status: 500 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles").select("build_credits, plan").eq("id", user.id).single();
  const isPro = profile?.plan === "pro"; // Pro = unlimited Plan Packs (no credit gate)
  if (!ownerFunded && !isPro && (!profile || profile.build_credits <= 0)) {
    return NextResponse.json(
      { error: "You're out of credits — get 3 for $10, or go Pro for unlimited.", code: "no_credits" },
      { status: 402 },
    );
  }

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // The idea seeds the prompt; when the builder brought docs but no idea, build
  // one from the docs so the schema/plan still has something to work from.
  let idea = ideaOverride ?? (project.build_prompt as string | null);
  if (!idea && docsInput.length > 0) {
    idea = docsInput.map((d) => `# ${d.name}\n${truncForPrompt(d.content)}`).join("\n\n");
  }
  if (!idea) return NextResponse.json({ error: "Describe your idea first." }, { status: 400 });
  if (!project.github_repo_url)
    return NextResponse.json({ error: "No GitHub repo linked to this project" }, { status: 400 });

  const repoMatch = project.github_repo_url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!repoMatch) return NextResponse.json({ error: "Could not parse GitHub repo URL" }, { status: 400 });
  const [, owner, rawRepo] = repoMatch;
  const repo = rawRepo.replace(/\.git$/, "");

  const { data: githubConn } = await supabase
    .from("oauth_connections").select("access_token")
    .eq("user_id", user.id).eq("provider", "github").single();
  if (!githubConn) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  const githubToken = await decrypt(githubConn.access_token as string);
  const octokit = new Octokit({ auth: githubToken });

  // The git identity the handed-off project must commit with, or Vercel blocks
  // the deploy ("commit email could not be matched to a GitHub account").
  // Best-effort — never block plan generation over it.
  let commitIdent: { email: string; name: string } | null = null;
  try { commitIdent = await getCommitIdentity(githubToken); } catch { /* non-fatal */ }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

      let creditUsed = false;
      try {
        if (!ownerFunded && !isPro) {
          const { data: deducted } = await supabase.rpc("use_build_credit", { p_user_id: user.id });
          creditUsed = deducted !== false;
        }

        const anthropic = new Anthropic({ apiKey: anthropicKey });

        let docs: Array<{ path: string; content: string }> = [];
        let summary = project.name as string;
        let plan: { now?: string[]; next?: string[]; later?: string[] } | null = null;
        let sprints: Array<{ title: string; items: string[] }> = [];
        let migrationSql = "";

        if (mode === "skip") {
          // ── Bring-your-own-docs, skip planning ──────────────────────────────
          // Don't regenerate the plan; just derive the DB (DB-first still holds)
          // plus a light summary/sequence for the UI. The builder's docs are
          // committed verbatim below.
          send({ step: "planning", message: "Reading your docs…" });
          const docsBlock = docsInput
            .map((d) => `=== ${d.name} (${d.kind}) ===\n${truncForPrompt(d.content)}`)
            .join("\n\n");
          const seedPrompt = `Project name: ${project.name}

The builder already wrote their own plan/specs (below). Do NOT rewrite or restate them.
Your ONLY job:
1) migration_sql — the database schema implied by their docs (DB-first).
2) summary — one line describing the app.
3) plan — a short now / next / later sequence in the app's own words.

${OS_METHOD}

The builder's docs:
${docsBlock}

Call seed_from_docs.`;

          const resp = await anthropic.messages.stream({
            model: PLAN_MODEL,
            max_tokens: 6000,
            tools: [SEED_FROM_DOCS_TOOL],
            tool_choice: { type: "tool", name: "seed_from_docs" },
            messages: [{ role: "user", content: seedPrompt }],
          }).finalMessage();

          const toolUse = resp.content.find((c) => c.type === "tool_use");
          if (toolUse && toolUse.type === "tool_use") {
            const input = toolUse.input as {
              summary?: string;
              plan?: { now?: string[]; next?: string[]; later?: string[] };
              migration_sql?: string;
            };
            if (input.summary) summary = input.summary;
            if (input.plan) plan = input.plan;
            if (typeof input.migration_sql === "string" && input.migration_sql.trim().length > 0)
              migrationSql = input.migration_sql.trim();
          }
          send({ step: "planning_done", message: `Loaded ${docsInput.length} of your docs ✓` });
        } else {
          // ── Classic generate, or ground-truth (grounded in the builder's docs) ─
          send({
            step: "planning",
            message: mode === "ground_truth"
              ? "Building the plan from your docs…"
              : "Studying your idea with the OS method…",
          });

          const sourceBlock = mode === "ground_truth" && prdDocs.length > 0
            ? `\n\nSOURCE DOCS — the builder already wrote these. Treat them as the SOURCE OF TRUTH for
scope, features, objects, and data. Restructure them into the pack specified below and FILL
GAPS, but do NOT contradict or drop their decisions. Derive DATA_MODEL.md and migration_sql
directly from their content.\n\n${prdDocs.map((d) => `=== ${d.name} ===\n${truncForPrompt(d.content)}`).join("\n\n")}`
            : "";
          const skillNote = skillDocs.length > 0
            ? `\n\nThe builder also provided agent skill specs (saved to .claude/skills/: ${skillDocs.map((d) => safeDocName(d.name)).join(", ")}). Assume the agent will follow them; don't reproduce them in the docs.`
            : "";

          const userPrompt = `Project name: ${project.name}

The builder's idea:
"${idea}"${sourceBlock}${skillNote}

${OS_METHOD}

${DOC_SPECS}

Call write_docs with ALL the doc files (concise, specific to THIS idea) and a one-line summary.`;

          for (let attempt = 1; attempt <= 2 && docs.length === 0; attempt++) {
            if (attempt > 1) send({ step: "planning", message: "Tightening the plan…" });
            const resp = await anthropic.messages.stream({
              model: PLAN_MODEL,
              // Capped low on purpose: concise docs finish in ~1-2 min, safely under
              // the 300s function limit. 64k let the model run ~13 min -> timeout.
              max_tokens: 16000,
              tools: [WRITE_DOCS_TOOL],
              tool_choice: { type: "tool", name: "write_docs" },
              messages: [{ role: "user", content: userPrompt }],
            }).finalMessage();

            const toolUse = resp.content.find((c) => c.type === "tool_use");
            if (toolUse && toolUse.type === "tool_use") {
              const input = toolUse.input as {
                files?: Array<{ path: string; content: string }>;
                summary?: string;
                plan?: { now?: string[]; next?: string[]; later?: string[] };
                sprints?: Array<{ title: string; items: string[] }>;
                migration_sql?: string;
              };
              docs = (Array.isArray(input.files) ? input.files : []).filter(
                (f) => f && typeof f.path === "string" && typeof f.content === "string"
                  && f.content.trim().length > 0 && f.path.startsWith("docs/") && f.path.endsWith(".md"),
              );
              if (input.summary) summary = input.summary;
              if (input.plan) plan = input.plan;
              if (Array.isArray(input.sprints)) sprints = input.sprints;
              if (typeof input.migration_sql === "string" && input.migration_sql.trim().length > 0)
                migrationSql = input.migration_sql.trim();
            }
            if (resp.stop_reason === "max_tokens") console.warn("[plan-pack] hit max_tokens, attempt", attempt);
          }

          if (docs.length === 0) throw new Error("The plan came back empty — please try again.");
          send({ step: "planning_done", message: `Drafted ${docs.length} planning docs ✓`, detail: docs.map((d) => d.path).join(", ") });
        }

        // Wire the database: apply the generated/derived schema to the project's
        // already-provisioned Supabase so the app has real tables from day one
        // (database-first, done for you). Best-effort — a failure here must NOT
        // lose the pack.
        const supabaseRef = (project.supabase_project_ref as string | null) ?? null;
        let schemaApplied = false;
        if (migrationSql) {
          send({ step: "wiring", message: "Wiring your database (applying the schema)…" });
          if (supabaseRef) {
            try {
              const { data: supaConn } = await supabase
                .from("oauth_connections").select("access_token")
                .eq("user_id", user.id).eq("provider", "supabase").single();
              if (supaConn?.access_token) {
                const supaToken = await decrypt(supaConn.access_token as string);
                await runMigration(supaToken, supabaseRef, migrationSql);
                schemaApplied = true;
                send({ step: "wiring_done", message: "Database wired — your schema is live ✓" });
              } else {
                send({ step: "wiring_skip", message: "Schema saved to your repo (connect Supabase to auto-apply it)." });
              }
            } catch (e) {
              console.warn("[plan-pack] schema apply failed:", e);
              send({ step: "wiring_skip", message: "Schema saved to your repo — apply it from supabase/migrations if needed." });
            }
          } else {
            send({ step: "wiring_skip", message: "Schema saved to your repo (no Supabase project linked yet)." });
          }
        }

        // The builder's own files (preserved). In ground-truth mode the generated
        // pack is canonical, so originals live under docs/source/. In skip mode
        // the builder's docs ARE the docs. Skill specs always go to .claude/skills/.
        const skillFiles = skillDocs.map((d) => ({
          path: `.claude/skills/${safeDocName(d.name)}`, content: d.content,
        }));
        const userDocFiles = mode === "skip"
          ? prdDocs.map((d) => ({ path: `docs/${safeDocName(d.name)}`, content: d.content }))
          : prdDocs.map((d) => ({ path: `docs/source/${safeDocName(d.name)}`, content: d.content }));

        // docPaths drives the "open these" list in CLAUDE.md.
        const docPathsForClaude = mode === "skip"
          ? userDocFiles.map((f) => f.path)
          : docs.map((d) => d.path);

        const allFiles = [
          ...docs,
          ...userDocFiles,
          ...skillFiles,
          ...(migrationSql ? [{ path: "supabase/migrations/0001_init.sql", content: migrationSql }] : []),
          {
            path: "CLAUDE.md",
            content: claudeMd(project.name as string, summary, docPathsForClaude, {
              hasMigration: !!migrationSql,
              applied: schemaApplied,
            }, {
              ownDocs: mode === "skip",
              skillFiles: skillFiles.map((f) => f.path.split("/").pop() as string),
              commit: commitIdent,
            }),
          },
        ];

        // Commit the whole pack in ONE atomic commit (Git Data API).
        send({ step: "committing", message: "Saving the pack to your repo…" });
        const { data: repoInfo } = await octokit.repos.get({ owner, repo });
        const branch = repoInfo.default_branch;
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
        const latestCommitSha = refData.object.sha;
        const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });

        const treeItems = await Promise.all(
          allFiles.map(async (file) => {
            const { data: blob } = await octokit.git.createBlob({
              owner, repo, content: Buffer.from(file.content).toString("base64"), encoding: "base64",
            });
            return { path: file.path, mode: "100644" as const, type: "blob" as const, sha: blob.sha };
          }),
        );
        const { data: newTree } = await octokit.git.createTree({
          owner, repo, base_tree: latestCommit.tree.sha, tree: treeItems,
        });
        const commitMessage =
          mode === "skip"
            ? (migrationSql
                ? "docs: add your specs + database schema migration"
                : "docs: add your specs")
            : mode === "ground_truth"
              ? (migrationSql
                  ? "docs: add plan pack (grounded in your specs) + database schema migration"
                  : "docs: add plan pack (grounded in your specs)")
              : (migrationSql
                  ? "docs: add plan pack (PRD, architecture, sprints) + database schema migration"
                  : "docs: add plan pack (PRD, architecture, sprints)");
        const { data: newCommit } = await octokit.git.createCommit({
          owner, repo, message: commitMessage, tree: newTree.sha, parents: [latestCommitSha],
        });
        await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: newCommit.sha });

        // Persist the whole pack so it survives refresh / tab changes (no
        // regenerate needed). Requires the projects.plan_pack jsonb column;
        // non-fatal if it doesn't exist yet.
        const packJson = {
          files: allFiles.map((f) => ({ path: f.path, content: f.content })),
          plan, sprints, summary, repoUrl: project.github_repo_url,
          commitEmail: commitIdent?.email ?? null,
          commitName: commitIdent?.name ?? null,
        };
        try {
          await supabase.from("projects").update({ build_prompt: idea, plan_pack: packJson }).eq("id", id);
        } catch {
          try { await supabase.from("projects").update({ build_prompt: idea }).eq("id", id); } catch { /* non-fatal */ }
        }

        send({
          step: "done",
          message: schemaApplied ? "Plan pack committed + database wired ✓" : "Plan pack committed ✓",
          files: allFiles.map((f) => ({ path: f.path, content: f.content })),
          plan,
          sprints,
          summary,
          repoUrl: project.github_repo_url,
          schemaApplied,
          commitEmail: commitIdent?.email ?? null,
          commitName: commitIdent?.name ?? null,
        });
      } catch (err) {
        console.error("[plan-pack] error:", err);
        if (creditUsed) { try { await supabase.rpc("refund_build_credit", { p_user_id: user.id }); } catch {} }
        const msg = friendlyAiError(err) ?? (err instanceof Error ? err.message : "Plan generation failed.");
        try { send({ step: "error", message: msg }); } catch {}
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
