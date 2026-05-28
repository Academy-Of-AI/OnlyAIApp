import Anthropic from "@anthropic-ai/sdk";
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
      model: "claude-opus-4-5",
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
          },
          required: ["onTrack", "currentMilestone", "progressNote", "scopeCreep", "courseCorrection"],
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

  return NextResponse.json({ report });
}
