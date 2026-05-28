import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * PATCH /api/projects/:id — update editable project fields
 * Body: { name?, vercel_preview_url? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    name?: string;
    vercel_preview_url?: string;
  };

  const updates: Record<string, string> = {};

  if (body.name !== undefined) {
    if (!body.name?.match(/^[a-z0-9-]{3,40}$/)) {
      return NextResponse.json(
        { error: "Name must be 3–40 lowercase letters, numbers, or hyphens" },
        { status: 400 },
      );
    }
    updates.name = body.name;
  }

  if (body.vercel_preview_url !== undefined) {
    const url = body.vercel_preview_url.trim();
    if (url && !url.startsWith("https://")) {
      return NextResponse.json(
        { error: "URL must start with https://" },
        { status: 400 },
      );
    }
    updates.vercel_preview_url = url;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)   // ensures user can only edit their own
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}
