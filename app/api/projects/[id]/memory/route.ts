import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const KINDS = ["objective", "decision", "architecture", "gotcha", "note"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("project_memory")
    .select("id, kind, content, created_at")
    .eq("project_id", id).eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ memory: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { kind?: string; content?: string };
  const kind = KINDS.includes(body.kind ?? "") ? body.kind! : "note";
  const content = body.content?.trim();
  if (!content) return NextResponse.json({ error: "Content required" }, { status: 400 });

  // Verify ownership of the project before writing
  const { data: project } = await supabase
    .from("projects").select("id").eq("id", id).eq("user_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("project_memory")
    .insert({ project_id: id, user_id: user.id, kind, content: content.slice(0, 2000) })
    .select("id, kind, content, created_at").single();

  if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const entryId = searchParams.get("entryId");
  if (!entryId) return NextResponse.json({ error: "entryId required" }, { status: 400 });

  await supabase.from("project_memory")
    .delete().eq("id", entryId).eq("project_id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
