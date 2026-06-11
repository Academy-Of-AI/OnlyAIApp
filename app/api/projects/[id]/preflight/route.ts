import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/plan";
import { runPilotChecks, isBlocking } from "@/lib/pilot/run";
import { NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * GET /api/projects/:id/preflight — Pilot's pre-deploy checks.
 *
 * Runs the checks engine and returns plain-English results so the "Go live"
 * button can show the intervention cards BEFORE deploying. Read-only: it never
 * mutates the project and never deploys. The engine is fail-open, so this can
 * only ever add information — it cannot break the deploy path.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: conns } = await supabase
    .from("oauth_connections").select("provider, access_token").eq("user_id", user.id);
  const githubConn = conns?.find((c) => c.provider === "github");
  const hasSupabaseConn = !!conns?.some((c) => c.provider === "supabase");
  const hasVercelConn = !!conns?.some((c) => c.provider === "vercel");

  let githubToken: string | undefined;
  try { if (githubConn?.access_token) githubToken = await decrypt(githubConn.access_token as string); }
  catch { /* token unreadable — repo-scan checks will self-skip */ }

  const repoMatch = (project.github_repo_url as string | null)?.match(/github\.com\/([^/]+\/[^/?#]+)/);
  const repoFullName = repoMatch ? repoMatch[1].replace(/\.git$/, "") : null;

  const checks = await runPilotChecks({
    project: {
      id: project.id,
      name: project.name,
      github_repo_url: project.github_repo_url ?? null,
      supabase_project_ref: project.supabase_project_ref ?? null,
      vercel_project_id: project.vercel_project_id ?? null,
    },
    githubToken,
    repoFullName,
    hasSupabaseConn,
    hasVercelConn,
  });

  const pro = await isProUser(supabase, user.id);
  return NextResponse.json({ ok: true, blocking: isBlocking(checks), pro, checks });
}
