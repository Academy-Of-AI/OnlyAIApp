import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai-models";
import { isProUser, PRO_REQUIRED } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { syncClaudeMd } from "@/lib/sync-claude-md";
import { NextResponse } from "next/server";

export const maxDuration = 120;

/**
 * POST /api/projects/:id/plan
 * Body: { objective, prd? } → LLM decomposes into milestones, stored as the
 * plan-of-record, then synced into CLAUDE.md so the agent stays anchored.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isProUser(supabase, user.id))) {
    return NextResponse.json(PRO_REQUIRED, { status: 402 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_SECRET_KEY;
  if (!anthropicKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const body = await req.json() as { objective?: string; prd?: string };
  const objective = body.objective?.trim();
  if (!objective) return NextResponse.json({ error: "Objective required" }, { status: 400 });
  const prd = body.prd?.trim()?.slice(0, 8000);

  const { data: project } = await supabase
    .from("projects").select("id").eq("id", id).eq("user_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Decompose into milestones via tool use
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let milestones: Array<{ title: string; detail: string }> = [];
  try {
    const res = await anthropic.messages.create({
      model: MODELS.reason,
      max_tokens: 3000,
      tools: [{
        name: "set_milestones",
        description: "Break the objective into an ordered milestone plan",
        input_schema: {
          type: "object" as const,
          properties: {
            milestones: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Short milestone title" },
                  detail: { type: "string", description: "One sentence on scope / done-criteria" },
                },
                required: ["title", "detail"],
              },
            },
          },
          required: ["milestones"],
        },
      }],
      tool_choice: { type: "any" },
      messages: [{
        role: "user",
        content: `Break this product objective into a tight, ordered milestone plan (5-9 milestones). Each milestone should be a shippable increment, scoped to avoid creep. Keep it to the objective — do not invent extra features.

Objective: "${objective}"
${prd ? `\nPRD / details:\n${prd}` : ""}

Call set_milestones.`,
      }],
    });
    const tool = res.content.find((c) => c.type === "tool_use");
    if (tool && tool.type === "tool_use") {
      const input = tool.input as { milestones?: Array<{ title: string; detail: string }> };
      milestones = (input.milestones ?? []).filter((m) => m?.title).slice(0, 12);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate plan" }, { status: 500 },
    );
  }
  if (milestones.length === 0) {
    return NextResponse.json({ error: "Could not generate milestones — try again." }, { status: 500 });
  }

  // Persist plan + milestones (latest plan wins)
  const { data: plan, error: planErr } = await supabase
    .from("project_plans")
    .insert({ project_id: id, user_id: user.id, objective, prd: prd ?? null })
    .select("id").single();
  if (planErr || !plan) return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });

  const rows = milestones.map((m, i) => ({
    plan_id: plan.id, user_id: user.id, position: i,
    title: m.title.slice(0, 200), detail: m.detail?.slice(0, 500) ?? null,
    status: i === 0 ? "in_progress" : "todo",
  }));
  await supabase.from("plan_milestones").insert(rows);

  // Anchor the agent: write objective + milestones into CLAUDE.md (best-effort)
  try { await syncClaudeMd(supabase, user.id, id); } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true, planId: plan.id, count: milestones.length });
}
