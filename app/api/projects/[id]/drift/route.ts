import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai-models";
import { Octokit } from "@octokit/rest";
import { decrypt } from "@/lib/crypto";
import { isProUser, PRO_REQUIRED } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 120;

interface DriftReport {
  onTrack: boolean;
  currentMilestone: string;
  progressNote: string;
  scopeCreep: Array<{ item: string; why: string }>;
  rabbitHole: { detected: boolean; area: string; note: string } | null;
  courseCorrection: string;
  // The ONE actionable move back on plan + a paste-ready instruction for the agent.
  correctionMove?: string;
  correctionPrompt?: string;
}

/**
 * Cheap, instant fallback that derives a one-move correction WITHOUT another LLM
 * call — used when the AI omits the fields or the call degrades. Points the agent
 * at the off-plan thing (first scope-creep item or rabbit hole) and the next
 * unfinished milestone in /docs/TASKS.md.
 */
function deriveCorrection(
  report: Pick<DriftReport, "scopeCreep" | "rabbitHole" | "courseCorrection">,
  nextPlanItem: string | null,
): { correctionMove: string; correctionPrompt: string } {
  const offPlan =
    report.rabbitHole?.detected && report.rabbitHole.area
      ? report.rabbitHole.area
      : report.scopeCreep?.[0]?.item ?? "the off-plan work";
  const target = nextPlanItem ?? "the next item in /docs/TASKS.md";
  const move =
    (report.courseCorrection && report.courseCorrection.trim()) ||
    `Stop ${offPlan} and return to ${target}.`;
  const prompt = `Refocus: stop building ${offPlan}; return to ${target} (see /docs/TASKS.md). Confirm the next milestone in one line, then work only on that until it's done.`;
  return { correctionMove: move, correctionPrompt: prompt };
}

/**
 * POST /api/projects/:id/drift
 * Pulls recent commits, compares them to the plan-of-record, and asks Claude
 * to flag scope creep + rabbit holes and keep the work on its objective.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isProUser(supabase, user.id))) {
    return NextResponse.json(PRO_REQUIRED, { status: 402 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_SECRET_KEY;
  if (!anthropicKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const { data: project } = await supabase
    .from("projects").select("name, github_repo_url")
    .eq("id", id).eq("user_id", user.id).single();
  if (!project?.github_repo_url) {
    return NextResponse.json({ error: "No GitHub repo linked" }, { status: 400 });
  }

  // Need a plan to measure drift against
  const { data: plan } = await supabase
    .from("project_plans").select("id, objective")
    .eq("project_id", id).eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!plan) {
    return NextResponse.json({ error: "Set a plan of record first.", code: "no_plan" }, { status: 400 });
  }
  const { data: milestones } = await supabase
    .from("plan_milestones").select("title, detail, status, position")
    .eq("plan_id", plan.id).order("position", { ascending: true });

  // Recent commits
  const m = project.github_repo_url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return NextResponse.json({ error: "Could not parse repo URL" }, { status: 400 });
  const owner = m[1]; const repo = m[2].replace(/\.git$/, "");

  const { data: ghConn } = await supabase
    .from("oauth_connections").select("access_token")
    .eq("user_id", user.id).eq("provider", "github").single();
  if (!ghConn) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  let commitLog = "";
  try {
    const octokit = new Octokit({ auth: await decrypt(ghConn.access_token as string) });
    const { data: commits } = await octokit.repos.listCommits({ owner, repo, per_page: 20 });
    commitLog = commits
      .map((c) => `- ${c.commit.message.split("\n")[0]}`)
      .join("\n");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read commits" }, { status: 500 },
    );
  }

  const planText = (milestones ?? [])
    .map((x) => `- [${x.status}] ${x.title}${x.detail ? ` — ${x.detail}` : ""}`)
    .join("\n");

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let report: DriftReport | null = null;
  try {
    const res = await anthropic.messages.create({
      model: MODELS.reason,
      max_tokens: 2000,
      tools: [{
        name: "report_drift",
        description: "Assess whether recent work is on-objective or drifting",
        input_schema: {
          type: "object" as const,
          properties: {
            onTrack: { type: "boolean" },
            currentMilestone: { type: "string", description: "Which milestone the recent work maps to" },
            progressNote: { type: "string", description: "One sentence on progress vs the plan" },
            scopeCreep: {
              type: "array",
              items: {
                type: "object",
                properties: { item: { type: "string" }, why: { type: "string" } },
                required: ["item", "why"],
              },
              description: "Work that doesn't map to any planned milestone",
            },
            rabbitHole: {
              type: "object",
              properties: {
                detected: { type: "boolean" },
                area: { type: "string" },
                note: { type: "string" },
              },
              required: ["detected", "area", "note"],
              description: "Disproportionate effort on one area vs the objective",
            },
            courseCorrection: { type: "string", description: "One-line nudge back toward the objective" },
            correctionMove: {
              type: "string",
              description: "If drifting: the SINGLE concrete thing to do to get back on plan, in one sentence. If on track, restate the next milestone to keep going.",
            },
            correctionPrompt: {
              type: "string",
              description: "A paste-ready instruction to hand the coding agent, e.g. \"Refocus: stop building <off-plan thing>; return to <next plan item> in /docs/TASKS.md\". Reference the real off-plan work + the next milestone by name.",
            },
          },
          required: ["onTrack", "currentMilestone", "progressNote", "scopeCreep", "courseCorrection", "correctionMove", "correctionPrompt"],
        },
      }],
      tool_choice: { type: "any" },
      messages: [{
        role: "user",
        content: `You are a strategic course-keeper. Compare recent work to the plan and flag drift. Be specific, not generic. If everything maps to the plan, say so (onTrack true, empty scopeCreep).

OBJECTIVE: ${plan.objective}

PLAN OF RECORD:
${planText || "(no milestones)"}

RECENT COMMITS (newest first):
${commitLog || "(none)"}

Then give ONE actionable correction: correctionMove (the single thing to do next to stay/get on plan, one sentence) and correctionPrompt (a paste-ready instruction the builder can hand straight to their coding agent — name the off-plan work to stop and the next milestone in /docs/TASKS.md to return to).

Call report_drift.`,
      }],
    });
    const tool = res.content.find((c) => c.type === "tool_use");
    if (tool && tool.type === "tool_use") report = tool.input as DriftReport;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Drift analysis failed" }, { status: 500 },
    );
  }
  if (!report) return NextResponse.json({ error: "No drift report produced" }, { status: 500 });

  // The next unfinished milestone is what "back on plan" means — fed to the
  // heuristic fallback so the paste-ready prompt names a real target.
  const nextPlanItem =
    (milestones ?? []).find((x) => x.status !== "done")?.title ?? null;

  // Guarantee the actionable correction even if the model omitted it (e.g. an
  // older path or a partial tool call) — no extra LLM call, instant + free.
  if (!report.correctionMove?.trim() || !report.correctionPrompt?.trim()) {
    const fallback = deriveCorrection(report, nextPlanItem);
    report.correctionMove = report.correctionMove?.trim() || fallback.correctionMove;
    report.correctionPrompt = report.correctionPrompt?.trim() || fallback.correctionPrompt;
  }

  // Persist the drift badge + correction so the Pilot dashboard / shared view
  // reflect this manual check too. Shape stays compatible with the auto-capture
  // last_digest badge ({ onTrack, note, scopeCreep }), with the correction added.
  try {
    await supabase
      .from("projects")
      .update({
        last_digest: {
          onTrack: report.onTrack,
          note: report.progressNote,
          scopeCreep: (report.scopeCreep ?? []).map((s) => s.item),
          correctionMove: report.correctionMove,
          correctionPrompt: report.correctionPrompt,
        },
        last_digest_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);
  } catch { /* non-fatal — the report is still returned below */ }

  return NextResponse.json({ report });
}
