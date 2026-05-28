import { runDigest } from "@/lib/auto-capture";
import { createAdminClient } from "@/lib/supabase/server";
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const maxDuration = 120;

/** Verify the GitHub HMAC signature when a secret is configured. */
function verify(raw: string, sig: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true; // not configured — accept (MVP); set the secret to enforce
  if (!sig) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch { return false; }
}

/**
 * POST /api/github/webhook
 * Fires on push. Matches the repo to a project and runs the auto-capture digest
 * (memory + milestones + drift + CLAUDE.md sync) for any project with
 * auto_capture enabled.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const sig = request.headers.get("x-hub-signature-256");
  if (!verify(raw, sig)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event !== "push") return NextResponse.json({ ok: true, ignored: event });

  let payload: {
    repository?: { full_name?: string };
    commits?: Array<{ message?: string }>;
    ref?: string;
  };
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad JSON" }, { status: 400 }); }

  const fullName = payload.repository?.full_name;
  if (!fullName) return NextResponse.json({ ok: true });

  // Only act on the default-ish branch pushes (skip tag/other refs noise)
  if (payload.ref && !/refs\/heads\/(main|master)$/.test(payload.ref)) {
    return NextResponse.json({ ok: true, ignored: "non-main ref" });
  }

  const commits = (payload.commits ?? []).map((c) => c.message ?? "").filter(Boolean);

  const admin = await createAdminClient();
  const { data: projects } = await admin
    .from("projects")
    .select("id, user_id, name, github_repo_url, auto_capture")
    .ilike("github_repo_url", `%${fullName}%`)
    .eq("auto_capture", true);

  if (!projects?.length) return NextResponse.json({ ok: true, matched: 0 });

  // Run digest for each matching project (await within maxDuration)
  for (const p of projects) {
    try {
      await runDigest(admin, p, commits);
    } catch (err) {
      console.error("[github/webhook] digest failed for", p.id, err);
    }
  }

  return NextResponse.json({ ok: true, matched: projects.length });
}
