import type { SupabaseClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

/**
 * Send a Pilot event to XP's Optimus agent over a SIGNED webhook (Optimus runs
 * deliver-only → Telegram, no LLM). Best-effort, NEVER throws. Ships DARK — a
 * no-op until both OPTIMUS_WEBHOOK_URL and OPTIMUS_WEBHOOK_SECRET are set in the
 * env, so it's safe to deploy before the endpoint exists.
 *
 * Auth contract (matches the Optimus side): HMAC-SHA256 of the RAW JSON body
 * with the shared secret, sent as `X-Webhook-Signature: <hex>` (GitHub-style
 * `X-Hub-Signature-256: sha256=<hex>` also sent for compatibility). Unsigned or
 * wrong-signature requests are rejected 401/403 — so Vercel's dynamic egress
 * IPs don't matter; the secret is the gate.
 *
 * SECURITY NOTE: the endpoint is plain HTTP, so HMAC guarantees AUTHENTICITY
 * (no forged alerts) but not CONFIDENTIALITY (the body is cleartext on the
 * wire). Keep `detail` free of secrets/PII; it's only low-sensitivity ops text.
 */
export async function notifyOptimus(e: {
  event: string;                                  // short code, e.g. "feedback", "payment_stalled", "build_failed"
  detail: string;                                 // human-readable line
  severity?: "high" | "medium" | "low" | "info";
  app?: string;
}): Promise<void> {
  const url = process.env.OPTIMUS_WEBHOOK_URL;
  const secret = process.env.OPTIMUS_WEBHOOK_SECRET;
  if (!url || !secret) return; // dark until configured

  const raw = JSON.stringify({
    event: e.event,
    app: e.app ?? "onlyaiapp",
    detail: e.detail,
    severity: e.severity ?? "info",
  });
  let sig: string;
  try { sig = createHmac("sha256", secret).update(raw).digest("hex"); }
  catch { return; }

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": sig,
        "X-Hub-Signature-256": `sha256=${sig}`,
      },
      body: raw,
      signal: AbortSignal.timeout(5000), // never hang the request on a slow VPS
    });
  } catch { /* non-fatal */ }
}

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

  // Optimus → Telegram (signed webhook). Best-effort, dark until configured.
  // PII-free heads-up only: category + page, NO username and NO message body —
  // the actual report content stays inside OnlyAIApp (read it in the dashboard).
  // This keeps user data off the external endpoint entirely.
  await notifyOptimus({
    event: "feedback",
    detail: `new ${f.category} report${f.page ? ` on ${f.page}` : ""} — open the dashboard to read it`,
    severity: f.category === "bug" ? "medium" : "low",
  });

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
