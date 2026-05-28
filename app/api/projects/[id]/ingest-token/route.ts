import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

/**
 * POST /api/projects/:id/ingest-token
 * Generates (or rotates) the project's CLI ingest token. The local `launchpad`
 * CLI uses it to push session context without a browser session.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = "lp_" + randomBytes(24).toString("hex");
  const { error } = await supabase
    .from("projects").update({ ingest_token: token })
    .eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ token });
}
