import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/wall — submit a finished build to The Wall.
 * Body: { projectId?, title, tagline?, demoUrl }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string; title?: string; tagline?: string; demoUrl?: string;
  };
  const title = body.title?.trim();
  const demoUrl = body.demoUrl?.trim();
  if (!title || !demoUrl) {
    return NextResponse.json({ error: "Title and a demo link are required." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles").select("full_name, github_username, is_builder").eq("id", user.id).single();
  const builderName =
    (profile?.full_name as string | null) ?? (profile?.github_username as string | null) ?? "A builder";

  const { data, error } = await supabase
    .from("wall_submissions")
    .insert({
      user_id: user.id,
      project_id: body.projectId ?? null,
      title,
      tagline: body.tagline?.trim() || null,
      demo_url: demoUrl,
      builder_name: builderName,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Auto-issue the Builder badge on first submission.
  if (!profile?.is_builder) {
    try { await supabase.from("profiles").update({ is_builder: true }).eq("id", user.id); } catch {}
  }

  return NextResponse.json({ ok: true, id: data.id });
}
