import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const PLAN_MODEL = process.env.BUILD_MODEL ?? "claude-sonnet-4-5";

/**
 * POST /api/projects/:id/plan-pack
 * Turns the builder's idea into the AI-App-Building-OS methodology pack — a set
 * of /docs files (PRD, ARCHITECTURE, DATA_MODEL, INTELLIGENCE_LAYER,
 * AGENTIC_LAYER, TASKS/sprints, SECURITY, TEST_PLAN) plus a CLAUDE.md that
 * points the agent at them — committed to the repo in ONE atomic commit, ready
 * to hand off to Claude Code / Codex. Streams SSE progress.
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
names, real fields, real copy. Concise but complete. No "TODO"/"Lorem"/"Feature 1".

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
- sprints: the same sprints as docs/TASKS.md, as {title, items[]}, ordered.`;

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
    },
    required: ["files"],
  },
};

function claudeMd(projectName: string, summary: string, docPaths: string[]): string {
  const list = docPaths.map((p) => `- \`${p}\``).join("\n");
  return `# ${projectName}

${summary}

## How to build this
This project was planned with the **AI App Building OS** method. Before writing code,
read the planning pack in \`/docs\`:

${list}

## Working rules (for the agent)
- Read \`docs/PRD.md\`, \`docs/ARCHITECTURE.md\`, \`docs/DATA_MODEL.md\`, \`docs/TASKS.md\` first.
- Build **Sprint 1 only**, then stop and let me review. Do not add anything outside the PRD.
- Doctrine: database-first, then coded logic, then intelligence on top. The core must run
  even with the AI switched off.
- Follow the Definition of Done in \`docs/TASKS.md\` for every task.
- Never expose secrets in frontend code. The agent inherits the user's permissions.

Kickoff: "Read /docs and build Sprint 1 from TASKS.md. Confirm the plan first."
`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { idea?: string };
  const ideaOverride = typeof body?.idea === "string" && body.idea.trim() ? body.idea.trim() : null;

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
    .from("profiles").select("build_credits").eq("id", user.id).single();
  if (!ownerFunded && (!profile || profile.build_credits <= 0)) {
    return NextResponse.json(
      { error: "You're out of credits — get 3 for $10 to generate your plan pack.", code: "no_credits" },
      { status: 402 },
    );
  }

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const idea = ideaOverride ?? (project.build_prompt as string | null);
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

      let creditUsed = false;
      try {
        if (!ownerFunded) {
          const { data: deducted } = await supabase.rpc("use_build_credit", { p_user_id: user.id });
          creditUsed = deducted !== false;
        }

        send({ step: "planning", message: "Studying your idea with the OS method…" });
        const anthropic = new Anthropic({ apiKey: anthropicKey });

        const userPrompt = `Project name: ${project.name}

The builder's idea:
"${idea}"

${OS_METHOD}

${DOC_SPECS}

Call write_docs with ALL the doc files (concise, specific to THIS idea) and a one-line summary.`;

        let docs: Array<{ path: string; content: string }> = [];
        let summary = project.name as string;
        let plan: { now?: string[]; next?: string[]; later?: string[] } | null = null;
        let sprints: Array<{ title: string; items: string[] }> = [];
        for (let attempt = 1; attempt <= 2 && docs.length === 0; attempt++) {
          if (attempt > 1) send({ step: "planning", message: "Tightening the plan…" });
          const resp = await anthropic.messages.stream({
            model: PLAN_MODEL,
            max_tokens: 64000,
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
            };
            docs = (Array.isArray(input.files) ? input.files : []).filter(
              (f) => f && typeof f.path === "string" && typeof f.content === "string"
                && f.content.trim().length > 0 && f.path.startsWith("docs/") && f.path.endsWith(".md"),
            );
            if (input.summary) summary = input.summary;
            if (input.plan) plan = input.plan;
            if (Array.isArray(input.sprints)) sprints = input.sprints;
          }
          if (resp.stop_reason === "max_tokens") console.warn("[plan-pack] hit max_tokens, attempt", attempt);
        }

        if (docs.length === 0) throw new Error("The plan came back empty — please try again.");
        send({ step: "planning_done", message: `Drafted ${docs.length} planning docs ✓`, detail: docs.map((d) => d.path).join(", ") });

        // Add the CLAUDE.md handoff file pointing at the pack.
        const allFiles = [
          ...docs,
          { path: "CLAUDE.md", content: claudeMd(project.name as string, summary, docs.map((d) => d.path)) },
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
        const { data: newCommit } = await octokit.git.createCommit({
          owner, repo,
          message: "docs: add AI-App-Building-OS plan pack (PRD, architecture, sprints)",
          tree: newTree.sha, parents: [latestCommitSha],
        });
        await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: newCommit.sha });

        // Persist a pointer so the project page can show the pack exists.
        try {
          await supabase.from("projects").update({ build_prompt: idea }).eq("id", id);
        } catch { /* non-fatal */ }

        send({
          step: "done",
          message: "Plan pack committed ✓",
          files: allFiles.map((f) => ({ path: f.path, content: f.content })),
          plan,
          sprints,
          summary,
          repoUrl: project.github_repo_url,
        });
      } catch (err) {
        console.error("[plan-pack] error:", err);
        if (creditUsed) { try { await supabase.rpc("refund_build_credit", { p_user_id: user.id }); } catch {} }
        try { send({ step: "error", message: err instanceof Error ? err.message : "Plan generation failed." }); } catch {}
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
