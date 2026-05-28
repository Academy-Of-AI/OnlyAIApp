import { runDigest } from "@/lib/auto-capture";
import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 120;

/**
 * POST /api/projects/:id/ingest
 * Token-authenticated (x-launchpad-token). Receives session text + WIP from the
 * local CLI and runs the digest against it — live-session capture.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.headers.get("x-launchpad-token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const admin = await createAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, user_id, name, github_repo_url, ingest_token, auto_capture")
    .eq("id", id).single();

  if (!project || project.ingest_token !== token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { sessionText?: string; wip?: string };
  const sessionText = [body.sessionText, body.wip ? `\nUncommitted WIP:\n${body.wip}` : ""]
    .filter(Boolean).join("\n").slice(0, 8000);
  if (!sessionText.trim()) return NextResponse.json({ error: "Nothing to ingest" }, { status: 400 });

  try {
    await runDigest(admin, project, { sessionText });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Digest failed" }, { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
