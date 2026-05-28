import { renderClaudeMd, type MemoryEntry, type Milestone } from "@/lib/claude-md";
import { decrypt } from "@/lib/crypto";
import { upsertFile } from "@/lib/github";
import type { SupabaseClient } from "@supabase/supabase-js";

// Accept either the SSR server client or the service-role admin client.
type DB = SupabaseClient;

/**
 * Build CLAUDE.md from a project's memory + plan-of-record and commit it to the
 * repo root. Claude Code reads it natively, so this is the bridge between the
 * control plane and the agent. Reused by the memory sync route and Phase 5 drift.
 */
export async function syncClaudeMd(
  supabase: DB,
  userId: string,
  projectId: string,
): Promise<{ ok: boolean; message?: string }> {
  const { data: project } = await supabase
    .from("projects").select("name, github_repo_url")
    .eq("id", projectId).eq("user_id", userId).single();
  if (!project?.github_repo_url) return { ok: false, message: "No GitHub repo linked." };

  const m = project.github_repo_url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return { ok: false, message: "Could not parse the GitHub repo URL." };
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, "");

  const { data: memoryRows } = await supabase
    .from("project_memory").select("kind, content")
    .eq("project_id", projectId).eq("user_id", userId)
    .order("created_at", { ascending: true });
  const memory: MemoryEntry[] = (memoryRows ?? []).map((r) => ({ kind: r.kind, content: r.content }));

  // Latest plan-of-record, if any
  const { data: plan } = await supabase
    .from("project_plans").select("id, objective")
    .eq("project_id", projectId).eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  let objective: string | null = null;
  let milestones: Milestone[] = [];
  if (plan) {
    objective = plan.objective;
    const { data: ms } = await supabase
      .from("plan_milestones").select("title, detail, status, position")
      .eq("plan_id", plan.id).order("position", { ascending: true });
    milestones = (ms ?? []).map((x) => ({ title: x.title, detail: x.detail, status: x.status }));
  }
  if (!objective) {
    objective = memory.find((e) => e.kind === "objective")?.content ?? null;
  }

  const md = renderClaudeMd({ projectName: project.name, objective, milestones, memory });

  const { data: conn } = await supabase
    .from("oauth_connections").select("access_token")
    .eq("user_id", userId).eq("provider", "github").single();
  if (!conn) return { ok: false, message: "GitHub not connected." };

  try {
    const token = await decrypt(conn.access_token as string);
    await upsertFile({
      token, owner, repo, path: "CLAUDE.md", content: md,
      message: "chore: sync CLAUDE.md (Launchpad memory)",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Failed to push CLAUDE.md." };
  }
}
