import { decrypt } from "@/lib/crypto";
import { registerPushWebhook } from "@/lib/github";
import { isProUser, PRO_REQUIRED } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST   /api/projects/:id/auto-capture  → enable (registers push webhook)
 * DELETE /api/projects/:id/auto-capture  → disable (flips the flag)
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isProUser(supabase, user.id))) {
    return NextResponse.json(PRO_REQUIRED, { status: 402 });
  }

  const { data: project } = await supabase
    .from("projects").select("github_repo_url")
    .eq("id", id).eq("user_id", user.id).single();
  if (!project?.github_repo_url) {
    return NextResponse.json({ error: "No GitHub repo linked" }, { status: 400 });
  }

  const m = project.github_repo_url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return NextResponse.json({ error: "Could not parse repo URL" }, { status: 400 });
  const owner = m[1]; const repo = m[2].replace(/\.git$/, "");

  const { data: ghConn } = await supabase
    .from("oauth_connections").select("access_token")
    .eq("user_id", user.id).eq("provider", "github").single();
  if (!ghConn) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? request.headers.get("origin")
    ?? "";
  const callbackUrl = `${appUrl}/api/github/webhook`;

  try {
    await registerPushWebhook({
      token: await decrypt(ghConn.access_token as string),
      owner, repo, callbackUrl,
      secret: process.env.GITHUB_WEBHOOK_SECRET,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not register webhook" }, { status: 500 },
    );
  }

  await supabase.from("projects").update({ auto_capture: true }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("projects").update({ auto_capture: false }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
