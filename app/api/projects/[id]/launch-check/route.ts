import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { runLaunchChecks } from "@/lib/launch-check";

export const maxDuration = 30;

/**
 * GET /api/projects/:id/launch-check
 * Runs backend launch-readiness checks (deploy state + live-page inspection)
 * and returns a checklist the member can act on with their own Claude Code.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const checks = await runLaunchChecks({
    url: (project.vercel_preview_url as string | null) ?? null,
    vercelToken,
    vercelProjectId: (project.vercel_project_id as string | null) ?? null,
    vercelTeamId,
  });

  return NextResponse.json({ checks });
}
