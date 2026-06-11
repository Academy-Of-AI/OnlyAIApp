import Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "@/lib/ai-models";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { healthReadLimit, normalizePlan } from "@/lib/plan";
import { fetchRepoDigest } from "@/lib/pilot/repo-read";
import {
  auditRepoFiles, detectStack, healthScore, grade, heuristicDraftPlan,
  type DraftMilestone, type Finding, type HealthReport,
} from "@/lib/pilot/repo-audit";
import { NextResponse } from "next/server";

export const maxDuration = 120;

/**
 * POST /api/repo-health — the existing-repo "Plan + drift health read."
 *
 * Point the Pilot at a GitHub repo the user already owns → read it (READ-ONLY,
 * budgeted) → (1) audit it against objective build standards (rules.ts; this is
 * falsifiable — file:line evidence, no AI needed) and (2) reverse-engineer a
 * DRAFT plan. The AI sharpens the plan + writes the summary on top, but the
 * findings stand on their own. We never write to the user's repo.
 *
 * Metered by HEALTH_READ_LIMITS (free gets 1 — the lead magnet).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const repoFullName = String((body as { repoFullName?: string }).repoFullName ?? "").trim();
  const m = repoFullName.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return NextResponse.json({ error: "Pick a repo as owner/name." }, { status: 400 });
  const [, owner, repo] = m;

  // Gate: lifetime allowance per tier (free = 1, the lead magnet).
  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const plan = normalizePlan(profile?.plan as string | null);
  const limit = healthReadLimit(plan);
  const { count: used } = await supabase
    .from("repo_health_reads").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (limit !== Infinity && (used ?? 0) >= limit) {
    return NextResponse.json(
      { error: "You've used your free repo health read. Upgrade for more.", code: "limit_reached", used: used ?? 0, limit },
      { status: 402 },
    );
  }

  // GitHub token.
  const { data: conn } = await supabase
    .from("oauth_connections").select("access_token").eq("user_id", user.id).eq("provider", "github").maybeSingle();
  if (!conn?.access_token) {
    return NextResponse.json({ error: "Connect GitHub to read an existing repo.", code: "github_required" }, { status: 400 });
  }
  let token: string;
  try { token = await decrypt(conn.access_token as string); }
  catch { return NextResponse.json({ error: "Your GitHub connection looks corrupted — reconnect GitHub.", code: "github_required" }, { status: 400 }); }

  // (1) Read the repo — READ-ONLY, budgeted.
  let digest;
  try {
    digest = await fetchRepoDigest({ token, owner, repo });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 404) return NextResponse.json({ error: `Couldn't find ${repoFullName}, or your GitHub connection can't access it.` }, { status: 404 });
    if (status === 403) return NextResponse.json({ error: `GitHub denied access to ${repoFullName} — check your connection's permissions.` }, { status: 403 });
    return NextResponse.json({ error: "Couldn't read that repo right now — try again in a moment." }, { status: 502 });
  }

  // (2) Objective-standards audit — deterministic, falsifiable.
  const findings: Finding[] = auditRepoFiles(digest.files);
  const stack = detectStack(digest);
  const score = healthScore(findings);
  const g = grade(score);

  const notes: string[] = [];
  if (digest.treeTruncated || digest.filesTruncated) {
    notes.push("This is a large repo — we audited a budgeted slice of the files, so some issues may sit outside what we scanned.");
  }
  notes.push("This plan is a draft reverse-engineered from your code — treat it as a starting point and edit it, not a verdict on intent.");

  // (3) AI layer — sharpen the draft plan + write the summary. Degrades cleanly:
  // no key or a failed call → the structural draft + a deterministic summary.
  let draftPlan = heuristicDraftPlan(digest);
  let summary = deterministicSummary(findings, score, stack);
  let aiUsed = false;

  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_SECRET_KEY;
  if (anthropicKey) {
    try {
      const ai = await synthesize({ key: anthropicKey, repoFullName, digest, findings, stack });
      if (ai) {
        draftPlan = { objective: ai.objective, milestones: ai.milestones, source: "ai" };
        summary = ai.summary;
        aiUsed = true;
      }
    } catch {
      notes.push("The AI plan step couldn't run just now — showing the structural draft and the objective checks (which don't need AI).");
    }
  } else {
    notes.push("AI plan step isn't configured here — showing the structural draft and the objective checks.");
  }

  const report: HealthReport = {
    repoFullName: digest.fullName, score, grade: g, summary, stack, findings, draftPlan, aiUsed, notes,
  };

  // Persist (so the user can revisit + so the free allowance is metered).
  const { data: saved } = await supabase
    .from("repo_health_reads")
    .insert({
      user_id: user.id,
      repo_full_name: report.repoFullName,
      score, grade: g, summary,
      stack, draft_plan: draftPlan, findings, ai_used: aiUsed, notes,
    })
    .select("id, created_at")
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    report,
    id: saved?.id ?? null,
    createdAt: saved?.created_at ?? null,
    used: (used ?? 0) + 1,
    limit,
  });
}

/**
 * GET /api/repo-health — the user's past reads (newest first) + the allowance,
 * so the page can render history without a round-trip per row.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  const plan = normalizePlan(profile?.plan as string | null);
  const limit = healthReadLimit(plan);

  const { data: reads, count } = await supabase
    .from("repo_health_reads")
    .select("id, repo_full_name, score, grade, summary, stack, draft_plan, findings, ai_used, notes, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    ok: true,
    reads: reads ?? [],
    used: count ?? 0,
    limit,
    plan,
  });
}

/** A deterministic, honest summary used when the AI layer is unavailable. */
function deterministicSummary(findings: Finding[], score: number, stack: string[]): string {
  const stackBit = stack.length ? `${stack.join(", ")} app. ` : "";
  if (!findings.length) return `${stackBit}No issues found against the objective build standards we check (score ${score}/100). We scanned a budgeted slice — review the draft plan below.`;
  const high = findings.filter((f) => f.severity === "high").length;
  const worst = findings[0];
  const highBit = high ? `${high} high-severity. ` : "";
  return `${stackBit}${findings.length} issue(s) found against objective build standards (${highBit}score ${score}/100). Biggest: ${worst.title} — ${worst.file}:${worst.line}.`;
}

interface AiSynthesis { objective: string; milestones: DraftMilestone[]; summary: string }

/** The AI layer: a draft plan + a plain-English summary. Bounded, single call. */
async function synthesize({
  key, repoFullName, digest, findings, stack,
}: {
  key: string;
  repoFullName: string;
  digest: Awaited<ReturnType<typeof fetchRepoDigest>>;
  findings: Finding[];
  stack: string[];
}): Promise<AiSynthesis | null> {
  const readme = digest.files.find((f) => /readme/i.test(f.path))?.content?.slice(0, 2500) ?? "(no README)";
  const pkg = digest.files.find((f) => f.path === "package.json")?.content?.slice(0, 1200) ?? "(no package.json)";
  const treeSample = digest.tree.slice(0, 200).join("\n");
  const findingLines = findings.slice(0, 20)
    .map((f) => `- [${f.severity}] ${f.title} (${f.file}:${f.line})`).join("\n") || "(none found by the deterministic audit)";

  const anthropic = new Anthropic({ apiKey: key });
  const res = await anthropic.messages.create({
    model: MODELS.reason,
    max_tokens: 1800,
    tools: [{
      name: "report_health",
      description: "Reverse-engineer a DRAFT plan for an existing repo and summarize its health honestly.",
      input_schema: {
        type: "object" as const,
        properties: {
          objective: { type: "string", description: "One sentence: what this app appears to be FOR, inferred from the code. Plain English, no hype." },
          milestones: {
            type: "array",
            description: "3–6 draft milestones that reconstruct how this app was (or should be) built, in order. Surfaces you can SEE in the code.",
            items: {
              type: "object",
              properties: { title: { type: "string" }, detail: { type: "string", description: "One line." } },
              required: ["title", "detail"],
            },
          },
          summary: { type: "string", description: "2–3 sentences, honest: the app's state and the single biggest risk from the findings. No flattery. If the findings list is empty, say the objective checks were clean and name what to verify next." },
        },
        required: ["objective", "milestones", "summary"],
      },
    }],
    tool_choice: { type: "tool", name: "report_health" },
    messages: [{
      role: "user",
      content: `You are reverse-engineering a DRAFT plan for an existing repo and reporting its health. Be specific and honest; this is a starting point the owner will edit, not a verdict.

REPO: ${repoFullName}
DETECTED STACK: ${stack.join(", ") || "unknown"}
DESCRIPTION: ${digest.description ?? "(none)"}

README (excerpt):
${readme}

package.json (excerpt):
${pkg}

FILE STRUCTURE (sample):
${treeSample}

OBJECTIVE-STANDARDS FINDINGS (from a deterministic audit — these are facts, reference them, don't invent new ones):
${findingLines}

Call report_health with: objective (what this app is for), milestones (3–6 draft steps that reconstruct the build), and summary (honest state + biggest risk). Keep it grounded in what's actually in the code.`,
    }],
  });
  const tool = res.content.find((c) => c.type === "tool_use");
  if (tool && tool.type === "tool_use") {
    const out = tool.input as Partial<AiSynthesis>;
    if (out.objective && Array.isArray(out.milestones) && out.summary) {
      return {
        objective: out.objective,
        milestones: out.milestones.filter((x): x is DraftMilestone => !!x?.title).slice(0, 6),
        summary: out.summary,
      };
    }
  }
  return null;
}
