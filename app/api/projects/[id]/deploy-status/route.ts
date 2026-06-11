import { decrypt } from "@/lib/crypto";
import { getLatestDeploymentStatus, getVercelProjectDomain } from "@/lib/vercel";
import { firstResolvingUrl } from "@/lib/pilot/canary";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/projects/[id]/deploy-status — the TRUTH about a build's deployment.
 *
 * Provisioning only *triggers* a Vercel deploy; the app used to flip straight to
 * "deployed" and hand the user a *.vercel.app link that 404s until the first
 * production build actually reaches READY. This route is the verifier the UI
 * polls: it reads the real deployment state from Vercel and settles the row —
 *   READY            → status "deployed" (+ deployed_at, real prod URL)
 *   ERROR / CANCELED → status "failed" (with a plain-English message)
 *   building/queued  → left as-is
 * so "deployed" only ever means "we confirmed it's live".
 *
 * Returns: { state: "ready" | "building" | "error" | "none", url?: string }
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, status, name, vercel_project_id, vercel_preview_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Already settled — answer from the row, no Vercel round-trip needed.
  if (project.status === "deployed") {
    return NextResponse.json({ state: "ready", url: project.vercel_preview_url ?? null });
  }
  if (project.status === "failed") return NextResponse.json({ state: "error" });
  if (!project.vercel_project_id) return NextResponse.json({ state: "none" });

  const { data: conn } = await supabase
    .from("oauth_connections")
    .select("access_token, metadata")
    .eq("user_id", user.id)
    .eq("provider", "vercel")
    .maybeSingle();
  if (!conn?.access_token) return NextResponse.json({ state: "building" });

  const token = await decrypt(conn.access_token as string);
  const teamId = (conn.metadata as { team_id?: string | null } | null)?.team_id ?? undefined;
  const projectId = project.vercel_project_id as string;

  const latest = await getLatestDeploymentStatus({ token, projectId, teamId });

  if (latest.state === "READY") {
    // Verified READY — but "READY" and "the link resolves" are different facts
    // (drift #1). getVercelProjectDomain falls back to a guessed
    // "<name>.vercel.app", which is WRONG for team accounts (the real alias has
    // a "-<scope>" suffix) and 404s. So we canary the candidates and settle
    // against the FIRST URL that actually answers (< 400): the resolved alias,
    // then the deployment's own URL (which always resolves for a READY deploy).
    const alias = await getVercelProjectDomain({ token, projectId, projectName: project.name as string, teamId });
    const guessed = `https://${project.name}.vercel.app`;
    const preferred = alias && alias !== guessed ? alias : (latest.url ?? alias);
    const url = await firstResolvingUrl([preferred, latest.url, alias]);

    // No candidate resolved yet — the build is READY but the alias/DNS hasn't
    // propagated. Do NOT claim "deployed" against a link we haven't seen answer;
    // stay "building" so the UI keeps polling until a URL truly resolves.
    if (!url) return NextResponse.json({ state: "building" });

    await supabase
      .from("projects")
      .update({ status: "deployed", deployed_at: new Date().toISOString(), vercel_preview_url: url }) // pilot-lint-ok: verified writer — READY + canary-confirmed URL only
      .eq("id", project.id);
    return NextResponse.json({ state: "ready", url });
  }

  if (latest.state === "ERROR" || latest.state === "CANCELED") {
    await supabase
      .from("projects")
      .update({
        status: "failed",
        error: "The deployment didn’t build successfully. Open the project to see the build error and redeploy.",
        provision_step: "deploy",
      })
      .eq("id", project.id);
    return NextResponse.json({ state: "error" });
  }

  return NextResponse.json({ state: "building" });
}
