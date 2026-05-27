import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** GET /api/hackathons/[id] — hackathon detail + participant list */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: hackathon } = await supabase
    .from("hackathons")
    .select("*")
    .eq("id", id)
    .eq("organizer_id", user.id)
    .single();

  if (!hackathon) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: participants } = await supabase
    .from("hackathon_participants")
    .select(`
      joined_at,
      user_id,
      profiles (email, full_name, github_username),
      projects (name, status, github_repo_url, vercel_preview_url)
    `)
    .eq("hackathon_id", id)
    .order("joined_at", { ascending: true });

  return NextResponse.json({ hackathon, participants: participants ?? [] });
}

/** PATCH /api/hackathons/[id] — update status (end/archive) */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { status?: string };

  const { data, error } = await supabase
    .from("hackathons")
    .update({ status: body.status })
    .eq("id", id)
    .eq("organizer_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
