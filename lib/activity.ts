import type { SupabaseClient } from "@supabase/supabase-js";

/** Append a project activity event. Best-effort. Works with any Supabase client. */
export async function logActivity(
  db: SupabaseClient,
  e: { userId: string; projectId: string; type: string; summary: string },
): Promise<void> {
  try {
    await db.from("project_activity").insert({
      project_id: e.projectId,
      user_id: e.userId,
      type: e.type,
      summary: e.summary.slice(0, 500),
    });
  } catch { /* non-fatal */ }
}
