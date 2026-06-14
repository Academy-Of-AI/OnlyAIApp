import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai-models";
import { createClient } from "@/lib/supabase/server";
import { artifactLimit } from "@/lib/plan";
import { NextResponse } from "next/server";

// This route makes an Anthropic call in-request — give it explicit headroom so a
// slow generation can't hit the host's default function timeout (drift #3).
export const maxDuration = 60;

type ArtifactType = "case_study" | "linkedin" | "resume";
const SITE = "onlyaiapp.com";

const PROMPTS: Record<ArtifactType, (ctx: string, name: string) => string> = {
  case_study: (ctx, name) =>
    `Write a crisp, credible one-page case study for ${name} about the app(s) below. ` +
    `Sections: Problem · What I built · How · Outcome · What it shows. ` +
    `Confident and specific, NO invented metrics, no fluff. Plain text. End with a line "Built with ${SITE}".\n\n${ctx}`,
  linkedin: (ctx, name) =>
    `Write a first-person LinkedIn post for ${name} announcing the app(s) below. ` +
    `Authentic, specific, lightly enthusiastic, 110–150 words, a few line breaks, 2–3 relevant hashtags. ` +
    `Mention it was built with ${SITE}. Use ONLY the facts below; invent nothing.\n\n${ctx}`,
  resume: (ctx, name) =>
    `Write 2–3 strong résumé bullet points for ${name} about the app(s) below. ` +
    `Action verbs, concrete, no invented metrics, one line each. Mention "built with ${SITE}" once. Plain text.\n\n${ctx}`,
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, projectId } = (await request.json().catch(() => ({}))) as { type?: ArtifactType; projectId?: string };
  if (!type || !(type in PROMPTS)) return NextResponse.json({ error: "Unknown artifact type" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, artifacts_used, artifacts_period, github_username").eq("id", user.id).single();

  // Monthly usage gate
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const used = profile?.artifacts_period === period ? (profile?.artifacts_used ?? 0) : 0;
  const limit = artifactLimit(profile?.plan);
  if (Number.isFinite(limit) && used >= limit) {
    return NextResponse.json(
      { error: `You've used your ${limit} AI writes this month — upgrade for more, or use the instant template.`, code: "limit" },
      { status: 403 },
    );
  }

  let query = supabase
    .from("projects").select("id, name, status, build_prompt, plan_progress")
    .eq("user_id", user.id).eq("status", "deployed");
  if (projectId) query = query.eq("id", projectId);
  const { data: shipped } = await query;
  if (!shipped || shipped.length === 0) {
    return NextResponse.json({ error: "Ship at least one app first — then we can write your proof." }, { status: 400 });
  }

  const name = profile?.github_username || "the builder";
  const ctx = shipped.map((p) => {
    const desc = (String(p.build_prompt ?? "").split(/\n/).find((l: string) => {
      const v = l.trim();
      return !!v && !/^#/.test(v) && !/\.(md|txt|pdf)\b/i.test(v);
    }) ?? "").trim().slice(0, 200);
    const ms = Array.isArray(p.plan_progress) ? p.plan_progress.length : 0;
    return `App: ${p.name}\nStatus: live / deployed\nWhat it does: ${desc || "a web app"}\nMilestones completed: ${ms}`;
  }).join("\n\n");

  const key = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const res = await anthropic.messages.create({
      model: MODELS.light,
      max_tokens: 700,
      messages: [{ role: "user", content: PROMPTS[type](ctx, name) }],
    });
    let text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    if (!text.toLowerCase().includes(SITE)) text += `\n\nBuilt with ${SITE}`;

    await supabase.from("profiles").update({ artifacts_used: used + 1, artifacts_period: period }).eq("id", user.id);
    const remaining = Number.isFinite(limit) ? limit - (used + 1) : null; // null = unlimited
    return NextResponse.json({ text, remaining });
  } catch (e) {
    console.error("[portfolio/artifact]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't generate — try again." }, { status: 500 });
  }
}
