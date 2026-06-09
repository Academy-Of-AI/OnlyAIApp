import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { runLaunchChecks } from "@/lib/launch-check";
import { checkLaunchReadiness } from "@/lib/launch-readiness";

export const maxDuration = 30;

/**
 * GET /api/projects/:id/launch-check
 * Runs backend launch-readiness checks for the OWNER's own project and returns:
 *   - checks:    the detailed deploy + live-page inspection (drives the Launch tab,
 *                each item carries a ready-to-paste Claude Code fix task).
 *   - readiness: the honest "is it ALIVE?" verdict — deployed & responding, not
 *                just a login wall, core v1 features shipped — with the single
 *                most important blocker. Drives the celebratory "it's alive" UI.
 * Owner-only (any tier): the project must belong to the signed-in user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load the user's OWN project (the .eq on user_id is the ownership gate).
  const { data: project } = await supabase
    .from("projects").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let vercelToken: string | null = null;
  let vercelTeamId: string | null = null;
  const { data: vercelConn } = await supabase
    .from("oauth_connections")
    .select("access_token, metadata")
    .eq("user_id", user.id)
    .eq("provider", "vercel")
    .single();
  if (vercelConn) {
    try {
      vercelToken = await decrypt(vercelConn.access_token as string);
      const meta = vercelConn.metadata as { team_id?: string | null } | null;
      vercelTeamId = meta?.team_id ?? null;
    } catch { /* non-fatal */ }
  }

  const url = (project.vercel_preview_url as string | null) ?? null;

  // The v1 "now" list (the plan of record) + what the builder has shipped.
  const planPack = project.plan_pack as { plan?: { now?: string[] } } | null;
  const nowTasks = Array.isArray(planPack?.plan?.now) ? planPack!.plan!.now! : [];
  const doneTasks = Array.isArray(project.plan_progress) ? (project.plan_progress as string[]) : [];

  // Run both in parallel — the detailed checklist and the "is it alive" verdict.
  const [checks, readiness] = await Promise.all([
    runLaunchChecks({
      url,
      vercelToken,
      vercelProjectId: (project.vercel_project_id as string | null) ?? null,
      vercelTeamId,
    }),
    checkLaunchReadiness({ url, nowTasks, doneTasks }),
  ]);

  return NextResponse.json({ checks, readiness });
}
