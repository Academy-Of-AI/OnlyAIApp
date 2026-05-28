import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";
import { logActivity } from "@/lib/activity";
import { decrypt } from "@/lib/crypto";
import { notify } from "@/lib/notify";
import { syncClaudeMd } from "@/lib/sync-claude-md";
import { logUsage } from "@/lib/usage";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  github_repo_url: string | null;
}

interface Digest {
  newMemory: Array<{ kind: string; content: string }>;
  milestoneUpdates: Array<{ title: string; status: string }>;
  drift: { onTrack: boolean; note: string; scopeCreep: string[] };
}

const VALID_KINDS = ["objective", "decision", "architecture", "gotcha", "note"];

/**
 * One push → one LLM "digest" call that:
 *  - extracts durable memory (decisions/gotchas) from the new commits,
 *  - advances milestone status,
 *  - assesses drift,
 * then applies the changes, stores a drift badge, and re-syncs CLAUDE.md.
 * Runs with the service-role client (no user session in a webhook).
 */
export async function runDigest(
  admin: SupabaseClient,
  project: ProjectRow,
  opts: { commits?: string[]; sessionText?: string } = {},
): Promise<void> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_SECRET_KEY;
  if (!anthropicKey || !project.github_repo_url) return;

  const m = project.github_repo_url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return;
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, "");

  const { data: ghConn } = await admin
    .from("oauth_connections").select("access_token")
    .eq("user_id", project.user_id).eq("provider", "github").single();

  // Prefer the commits from this push; fall back to recent history (if GitHub
  // is connected). Session text from the local CLI can stand in on its own.
  let commitLog = (opts.commits ?? []).map((c) => `- ${c.split("\n")[0]}`).join("\n");
  if (!commitLog && ghConn) {
    try {
      const octokit = new Octokit({ auth: await decrypt(ghConn.access_token as string) });
      const { data: commits } = await octokit.repos.listCommits({ owner, repo, per_page: 10 });
      commitLog = commits.map((c) => `- ${c.commit.message.split("\n")[0]}`).join("\n");
    } catch { /* continue with session text only */ }
  }
  const sessionText = (opts.sessionText ?? "").slice(0, 8000);
  if (!commitLog.trim() && !sessionText.trim()) return;

  // Existing context
  const { data: memRows } = await admin
    .from("project_memory").select("content")
    .eq("project_id", project.id).eq("user_id", project.user_id);
  const existing = (memRows ?? []).map((r) => String(r.content).toLowerCase());

  const { data: plan } = await admin
    .from("project_plans").select("id, objective")
    .eq("project_id", project.id).eq("user_id", project.user_id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  let milestones: Array<{ id: string; title: string; status: string }> = [];
  if (plan) {
    const { data: ms } = await admin
      .from("plan_milestones").select("id, title, status")
      .eq("plan_id", plan.id).order("position", { ascending: true });
    milestones = ms ?? [];
  }

  // Single digest call
  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let digest: Digest | null = null;
  try {
    const res = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      tools: [{
        name: "digest",
        description: "Capture memory, advance milestones, and assess drift from recent commits",
        input_schema: {
          type: "object" as const,
          properties: {
            newMemory: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string", description: "decision | architecture | gotcha | note" },
                  content: { type: "string", description: "One durable fact worth remembering" },
                },
                required: ["kind", "content"],
              },
              description: "Durable decisions/gotchas from the commits NOT already in memory. Empty if none.",
            },
            milestoneUpdates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Exact milestone title" },
                  status: { type: "string", description: "todo | in_progress | done" },
                },
                required: ["title", "status"],
              },
              description: "Milestones whose status changed based on the commits. Empty if none.",
            },
            drift: {
              type: "object",
              properties: {
                onTrack: { type: "boolean" },
                note: { type: "string", description: "One sentence on progress vs objective" },
                scopeCreep: { type: "array", items: { type: "string" } },
              },
              required: ["onTrack", "note", "scopeCreep"],
            },
          },
          required: ["newMemory", "milestoneUpdates", "drift"],
        },
      }],
      tool_choice: { type: "any" },
      messages: [{
        role: "user",
        content: `${commitLog ? `Recent commits on this project:\n${commitLog}\n` : ""}${sessionText ? `\nRecent Claude Code session (decisions, what was tried):\n${sessionText}\n` : ""}
${plan ? `Objective: ${plan.objective}` : "No objective set."}
${milestones.length ? `Milestones:\n${milestones.map((x) => `- [${x.status}] ${x.title}`).join("\n")}` : ""}
Existing memory (do NOT duplicate): ${existing.length ? existing.slice(0, 30).join(" | ") : "(none)"}

Call digest. Only surface durable, specific facts and real status changes.`,
      }],
    });
    const tool = res.content.find((c) => c.type === "tool_use");
    if (tool && tool.type === "tool_use") digest = tool.input as Digest;
    await logUsage(admin, {
      userId: project.user_id, projectId: project.id, kind: "digest",
      inputTokens: res.usage?.input_tokens, outputTokens: res.usage?.output_tokens,
    });
  } catch { return; }
  if (!digest) return;

  // Apply new memory (deduped, validated)
  const inserts = (digest.newMemory ?? [])
    .filter((e) => e?.content && !existing.some((x) => x.includes(e.content.toLowerCase().slice(0, 40))))
    .slice(0, 8)
    .map((e) => ({
      project_id: project.id, user_id: project.user_id,
      kind: VALID_KINDS.includes(e.kind) ? e.kind : "note",
      content: e.content.slice(0, 2000),
    }));
  if (inserts.length) {
    await admin.from("project_memory").insert(inserts);
    await logActivity(admin, {
      userId: project.user_id, projectId: project.id, type: "memory",
      summary: `Captured ${inserts.length} memory item${inserts.length > 1 ? "s" : ""} from recent work`,
    });
  }

  // Advance milestones (match by title) + notify on completion
  for (const u of digest.milestoneUpdates ?? []) {
    if (!["todo", "in_progress", "done"].includes(u.status)) continue;
    const match = milestones.find((x) => x.title.trim().toLowerCase() === u.title.trim().toLowerCase());
    if (match && match.status !== u.status) {
      await admin.from("plan_milestones").update({ status: u.status }).eq("id", match.id);
      await logActivity(admin, {
        userId: project.user_id, projectId: project.id, type: "milestone",
        summary: `Milestone "${match.title}" → ${u.status}`,
      });
      if (u.status === "done") {
        await notify(admin, project.user_id, {
          type: "milestone", projectId: project.id,
          title: `Milestone done: ${match.title}`,
          body: `${project.name} advanced a milestone.`,
        });
      }
    }
  }

  // Notify on drift
  if (digest.drift && digest.drift.onTrack === false) {
    await notify(admin, project.user_id, {
      type: "drift", projectId: project.id,
      title: `${project.name} is drifting`,
      body: digest.drift.note ?? "Recent work is off the objective.",
    });
  }

  // Store drift badge on the project
  await admin.from("projects").update({
    last_digest: digest.drift,
    last_digest_at: new Date().toISOString(),
  }).eq("id", project.id);

  // Re-sync CLAUDE.md so the agent sees the updated state
  try { await syncClaudeMd(admin, project.user_id, project.id); } catch { /* non-fatal */ }
}
