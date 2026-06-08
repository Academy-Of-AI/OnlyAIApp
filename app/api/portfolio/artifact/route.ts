import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { normalizePlan } from "@/lib/plan";
import { NextResponse } from "next/server";

type ArtifactType = "case_study" | "linkedin" | "resume";

const PROMPTS: Record<ArtifactType, (ctx: string, name: string) => string> = {
  case_study: (ctx, name) =>
    `You are helping ${name} write a short, credible case study about apps they built and shipped. ` +
    `Using ONLY the facts below, write a 1-page case study (Problem → What they built → Outcome → What it shows). ` +
    `Confident but honest; no hype, no invented metrics. Plain text.\n\n${ctx}`,
  linkedin: (ctx, name) =>
    `Write a first-person LinkedIn post for ${name} announcing the real app(s) they shipped. ` +
    `Authentic, specific, lightly enthusiastic, 120-160 words, a few tasteful line breaks, 2-3 relevant hashtags. ` +
    `Use ONLY the facts below; do not invent numbers.\n\n${ctx}`,
  resume: (ctx, name) =>
    `Write 2-3 résumé bullet points for ${name} describing the apps they designed and shipped. ` +
    `Strong action verbs, concrete, no invented metrics, one line each. Plain text.\n\n${ctx}`,
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = (await request.json().catch(() => ({}))) as { type?: ArtifactType };
  if (!type || !(type in PROMPTS)) return NextResponse.json({ error: "Unknown artifact type" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles").select("plan, github_username").eq("id", user.id).single();
  if (normalizePlan(profile?.plan) !== "pro") {
    return NextResponse.json({ error: "Career artifacts are a Pro feature." }, { status: 403 });
  }

  const { data: projects } = await supabase
    .from("projects").select("name, status, build_prompt, plan_progress").eq("user_id", user.id);
  const shipped = (projects ?? []).filter((p) => p.status === "deployed");
  if (shipped.length === 0) {
    return NextResponse.json({ error: "Ship at least one app first — then we can write your proof." }, { status: 400 });
  }

  const name = profile?.github_username || "the builder";
  const ctx = shipped.map((p) => {
    const milestones = Array.isArray(p.plan_progress) ? p.plan_progress.length : 0;
    const desc = (p.build_prompt ?? "").trim().split(/\n/)[0].slice(0, 200);
    return `App: ${p.name}\nStatus: live / deployed\nWhat it does: ${desc || "a web app"}\nMilestones completed: ${milestones}`;
  }).join("\n\n");

  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_SECRET_KEY;
  if (!anthropicKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });
    const res = await anthropic.messages.create({
      model: process.env.BUILD_MODEL || "claude-opus-4-5",
      max_tokens: 900,
      messages: [{ role: "user", content: PROMPTS[type](ctx, name) }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[portfolio/artifact]", err);
    return NextResponse.json({ error: "Couldn’t generate right now — try again." }, { status: 500 });
  }
}
