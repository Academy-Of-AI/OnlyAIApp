import { createClient } from "@/lib/supabase/server";
import { syncClaudeMd } from "@/lib/sync-claude-md";
import { NextResponse } from "next/server";

/**
 * POST /api/projects/:id/memory/sync
 * Renders the project's memory + plan into CLAUDE.md and commits it to the repo.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await syncClaudeMd(supabase, user.id, id);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
