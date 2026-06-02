import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST /api/wall/:id/upvote — public, increments via security-definer RPC. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.rpc("wall_upvote", { p_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
