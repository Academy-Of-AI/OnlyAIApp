import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { isProUser, PRO_REQUIRED } from "@/lib/plan";
import { rollbackVercelProject } from "@/lib/vercel";
import { NextResponse } from "next/server";

/**
 * POST /api/projects/:id/rollback
 * Re-deploys the previous successful production commit.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // One-click deploy rollback is a Pro feature (advanced ops).
  if (!(await isProUser(supabase, user.id))) {
    return NextResponse.json(PRO_REQUIRED, { status: 402 });
  }

  const { data: project } = await supabase
    .from("projects").select("name, vercel_project_id")
    .eq("id", id).eq("user_id", user.id).single();
  if (!project?.vercel_project_id) {
    return NextResponse.json({ error: "No Vercel project linked" }, { status: 400 });
  }

  const { data: conn } = await supabase
    .from("oauth_connections").select("access_token, metadata")
    .eq("user_id", user.id).eq("provider", "vercel").single();
  if (!conn) return NextResponse.json({ error: "Vercel not connected" }, { status: 400 });

  const token = await decrypt(conn.access_token as string);
  const meta = conn.metadata as { team_id?: string | null } | null;

  const result = await rollbackVercelProject({
    token,
    projectId: project.vercel_project_id as string,
    projectName: project.name as string,
    teamId: meta?.team_id ?? undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ ok: true, sha: result.sha });
}
