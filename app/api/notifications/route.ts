import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabase
    .from("notifications").select("id, type, title, body, read, created_at, project_id")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ notifications: data ?? [] });
}

/** PATCH → mark all read (or one if id provided). */
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { id?: string };
  const q = supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
  if (body.id) await q.eq("id", body.id); else await q.eq("read", false);
  return NextResponse.json({ ok: true });
}
