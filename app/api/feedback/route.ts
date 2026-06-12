import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notifyOwnerOfFeedback } from "@/lib/notify";
import { NextResponse } from "next/server";

const CATEGORIES = new Set(["bug", "confusing", "idea", "other"]);
const MAX_MESSAGE = 4000;

/**
 * POST /api/feedback — in-app bug / feedback submitter.
 * Stores the report (RLS: user can only insert their own). Feeds the loop that
 * turns real pain into new Pilot checks.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const message = String(body.message ?? "").trim().slice(0, MAX_MESSAGE);
  if (!message) return NextResponse.json({ error: "Tell us what happened." }, { status: 400 });

  const category = CATEGORIES.has(String(body.category)) ? String(body.category) : "bug";
  const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;
  const context =
    body.context && typeof body.context === "object" && !Array.isArray(body.context)
      ? (body.context as Record<string, unknown>)
      : {};

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    project_id: projectId,
    category,
    message,
    context,
  });
  if (error) {
    console.error("[feedback] insert failed:", error.message);
    return NextResponse.json({ error: "Couldn't save that — please try again." }, { status: 500 });
  }

  // Best-effort: tell the owner a report came in, so it doesn't sit unseen.
  // Never blocks or fails the submission. No-op until FEEDBACK_NOTIFY_* is set.
  try {
    const { data: prof } = await supabase
      .from("profiles").select("github_username").eq("id", user.id).maybeSingle();
    const page = typeof context.url === "string" ? context.url : null;
    const admin = await createAdminClient();
    await notifyOwnerOfFeedback(admin, {
      category,
      who: prof?.github_username ?? user.email ?? user.id.slice(0, 8),
      page,
      message,
    });
  } catch { /* non-fatal — the report is already saved */ }

  return NextResponse.json({ ok: true });
}
