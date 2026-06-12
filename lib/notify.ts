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

/**
 * Tell the platform owner a user filed feedback — so reports don't sit unseen in
 * the DB. Best-effort, NEVER throws (the feedback insert must succeed regardless).
 * Two independent, optional channels — both no-op until configured, so this ships
 * dark and turns on with one env var:
 *   • email     → set FEEDBACK_NOTIFY_EMAIL (uses the VERIFIED Resend domain
 *                 RESEND_FROM_DOMAIN, not the placeholder above).
 *   • in-app bell → set FEEDBACK_NOTIFY_USER_ID to your own user id.
 * Pass the SERVICE-ROLE admin client — the bell insert targets a different user
 * (the owner), which the RLS-bound user client can't write.
 */
export async function notifyOwnerOfFeedback(
  admin: SupabaseClient,
  f: { category: string; who: string; page?: string | null; message: string },
): Promise<void> {
  const title = `🐞 ${f.category} report from ${f.who}`;
  const body = `${f.page ? `Page: ${f.page}\n` : ""}${f.message}`;

  const ownerId = process.env.FEEDBACK_NOTIFY_USER_ID;
  if (ownerId) {
    try {
      await admin.from("notifications").insert({
        user_id: ownerId, type: "feedback", title, body: body.slice(0, 500),
      });
    } catch { /* non-fatal */ }
  }

  const key = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_NOTIFY_EMAIL ?? process.env.NOTIFY_EMAIL;
  const domain = process.env.RESEND_FROM_DOMAIN;
  if (!key || !to || !domain) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `OnlyAIApp <noreply@${domain}>`,
        to,
        subject: title,
        text: body.slice(0, 2000),
      }),
    });
  } catch { /* non-fatal */ }
}
