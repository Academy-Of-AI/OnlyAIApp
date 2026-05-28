import Anthropic from "@anthropic-ai/sdk";
import { notify } from "@/lib/notify";
import { isProUser } from "@/lib/plan";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 300;

/**
 * GET /api/cron/retro  (Vercel Cron, weekly)
 * For each auto-capture project, summarize the week's activity into a retro
 * (shipped / drifted / next) and notify the owner.
 */
export async function GET(req: Request) {
  // Verify it's Vercel Cron when CRON_SECRET is configured
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_SECRET_KEY;
  if (!anthropicKey) return NextResponse.json({ ok: true, skipped: "no AI key" });

  const admin = await createAdminClient();
  const { data: projects } = await admin
    .from("projects").select("id, user_id, name").eq("auto_capture", true);
  if (!projects?.length) return NextResponse.json({ ok: true, projects: 0 });

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  let sent = 0;

  for (const p of projects) {
    // Retro is a Pro feature (runs AI on us) — skip free owners
    if (!(await isProUser(admin, p.user_id))) continue;

    const { data: acts } = await admin
      .from("project_activity").select("type, summary, created_at")
      .eq("project_id", p.id).gte("created_at", weekAgo)
      .order("created_at", { ascending: false }).limit(50);
    if (!acts?.length) continue;

    const { data: plan } = await admin
      .from("project_plans").select("id, objective")
      .eq("project_id", p.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let milestoneLine = "";
    if (plan) {
      const { data: ms } = await admin.from("plan_milestones")
        .select("title, status").eq("plan_id", plan.id).order("position");
      milestoneLine = (ms ?? []).map((m) => `[${m.status}] ${m.title}`).join(", ");
    }

    let retro = "";
    try {
      const res = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Write a 3-line weekly retro for project "${p.name}" — Shipped, Watch (drift/risks), Next.
${plan ? `Objective: ${plan.objective}` : ""}
Milestones: ${milestoneLine || "none"}
This week's activity:
${acts.map((a) => `- ${a.summary}`).join("\n")}

Be specific and terse. Format as "Shipped: ... / Watch: ... / Next: ...".`,
        }],
      });
      retro = res.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join(" ").trim();
    } catch { continue; }

    if (retro) {
      await notify(admin, p.user_id, {
        type: "retro", projectId: p.id,
        title: `Weekly retro · ${p.name}`,
        body: retro.slice(0, 800),
      });
      sent++;
    }
  }

  return NextResponse.json({ ok: true, projects: projects.length, retros: sent });
}
