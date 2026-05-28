import { createClient } from "@/lib/supabase/server";
import { syncClaudeMd } from "@/lib/sync-claude-md";
import { NextResponse } from "next/server";

/**
 * PATCH /api/projects/:id/plan/milestone
 * Body: { milestoneId, status } — toggle a milestone's status, then re-sync
 * CLAUDE.md so the agent always sees the current milestone.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { milestoneId?: string; status?: string };
  if (!body.milestoneId || !["todo", "in_progress", "done"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "milestoneId and valid status required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("plan_milestones")
    .update({ status: body.status })
    .eq("id", body.milestoneId).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  try { await syncClaudeMd(supabase, user.id, id); } catch { /* non-fatal */ }
  return NextResponse.json({ ok: true });
}
