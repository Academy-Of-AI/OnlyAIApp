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
 * SECURITY: HMAC guarantees AUTHENTICITY (no forged alerts), not CONFIDENTIALITY.
 * So `sensitive` detail (user content/PII) is ONLY put on the wire when the
 * endpoint is https (encrypted); over plain http it auto-downgrades to a non-PII
 * pointer. Cleartext PII can't leak even if OPTIMUS_WEBHOOK_URL is misconfigured.
 */
export async function notifyOptimus(e: {
  event: string;                                  // short code, e.g. "feedback", "payment_stalled", "build_failed"
  detail: string;                                 // human-readable line
  severity?: "high" | "medium" | "low" | "info";
  app?: string;
  sensitive?: boolean;                            // detail carries user content → https-only
}): Promise<void> {
  // .trim() defensively: a trailing newline/space pasted into the Vercel env
  // value silently changes the HMAC key (or breaks the URL) → invalid signature.
  const url = process.env.OPTIMUS_WEBHOOK_URL?.trim();
  const secret = process.env.OPTIMUS_WEBHOOK_SECRET?.trim();
  if (!url || !secret) return; // dark until configured

  // Confidentiality guard: only send user content over an ENCRYPTED endpoint.
  const detail = e.sensitive && !url.toLowerCase().startsWith("https://")
    ? "a new report came in — open the dashboard to read it"
    : e.detail;

  const raw = JSON.stringify({
    event: e.event,
    app: e.app ?? "onlyaiapp",
    detail,
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
  f: { category: string; who: string; page?: string | null; message: string; screenshotPath?: string | null },
): Promise<void> {
  const title = `🐞 ${f.category} report from ${f.who}`;

  // The screenshot lives in the PRIVATE `feedback` bucket — unreachable by URL.
  // Mint a short-lived signed link (service-role bypasses RLS) so the owner can
  // view it from the alert. The link expiring is fine: the durable artifact is
  // the path on the feedback row, which the Pilot re-signs/downloads on demand.
  let shotUrl: string | null = null;
  if (f.screenshotPath) {
    try {
      const { data } = await admin.storage
        .from("feedback")
        .createSignedUrl(f.screenshotPath, 60 * 60 * 24 * 7); // 7 days
      shotUrl = data?.signedUrl ?? null;
    } catch { /* non-fatal — the alert still goes out, just without the link */ }
  }

  const body = `${f.page ? `Page: ${f.page}\n` : ""}${f.message}${shotUrl ? `\n📎 ${shotUrl}` : ""}`;

  const ownerId = process.env.FEEDBACK_NOTIFY_USER_ID;
  if (ownerId) {
    try {
      await admin.from("notifications").insert({
        user_id: ownerId, type: "feedback", title, body: body.slice(0, 500),
      });
    } catch { /* non-fatal */ }
  }

  // Optimus → Telegram (signed webhook). Best-effort, dark until configured.
  // Sends the actual report text + page (capped 300), then the screenshot URL
  // appended AFTER the cap so a long message can't truncate the link — but
  // `sensitive` means the whole detail only rides an https endpoint; over plain
  // http it downgrades to a pointer (so the URL never leaks in cleartext either).
  // Reporter/username intentionally omitted (read it in the dashboard if needed).
  await notifyOptimus({
    event: "feedback",
    detail: `${`${f.page ? `${f.page}: ` : ""}${f.message}`.slice(0, 300)}${shotUrl ? `\n📎 ${shotUrl}` : ""}`,
    severity: f.category === "bug" ? "medium" : "low",
    sensitive: true,
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
