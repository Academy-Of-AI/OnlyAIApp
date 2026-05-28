import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Create an in-app notification. Best-effort email is sent if a platform
 * RESEND_API_KEY is configured (optional). Works with either the SSR client
 * or the service-role admin client.
 */
export async function notify(
  db: SupabaseClient,
  userId: string,
  n: { type?: string; title: string; body?: string; projectId?: string },
): Promise<void> {
  try {
    await db.from("notifications").insert({
      user_id: userId,
      project_id: n.projectId ?? null,
      type: n.type ?? "info",
      title: n.title,
      body: n.body ?? null,
    });
  } catch { /* non-fatal */ }

  // Optional email via platform Resend key
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL; // platform owner email, optional
  if (!key || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Launchpad <notify@launchpad.app>",
        to,
        subject: n.title,
        text: n.body ?? n.title,
      }),
    });
  } catch { /* non-fatal */ }
}
