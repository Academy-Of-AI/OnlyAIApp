import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { getDeploymentErrorLine, getLatestDeploymentStatus } from "@/lib/vercel";
import { explainDeployError } from "@/lib/explain-error";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/:id/explain-error
 * The signature Pilot Lite move: look at the user's latest deploy and, if it
 * failed, turn the scary build error into a plain-English diagnosis + ONE next
 * step + a paste-ready fix prompt. FREE users get this on their own project —
 * it's the core "turn a scary error into your one next step" promise.
 *
 * Returns:
 *   { ok: true, broken: false }                                  — latest deploy is fine
 *   { ok: true, whatBroke, nextStep, fixPrompt, errorLine? }     — latest deploy failed
 *   { ok: true, broken: false, reason }                          — can't check (no vercel / no project)
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load the user's OWN project (RLS-safe owner scope). No plan gate — free too.
  const { data: project } = await supabase
    .from("projects").select("vercel_project_id")
    .eq("id", id).eq("user_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Not linked to Vercel yet — nothing to diagnose, but not an error state.
  if (!project.vercel_project_id) {
    return NextResponse.json({ ok: true, broken: false, reason: "no_vercel" });
  }

  // Decrypt the user's Vercel token (mirror pilot/page.tsx). If we can't, degrade
  // gracefully — never leak the failure.
  const { data: conn } = await supabase
    .from("oauth_connections").select("access_token, metadata")
    .eq("user_id", user.id).eq("provider", "vercel").single();
  if (!conn) return NextResponse.json({ ok: true, broken: false, reason: "no_vercel" });

  let token: string;
  let teamId: string | undefined;
  try {
    token = await decrypt(conn.access_token as string);
    const meta = conn.metadata as { team_id?: string | null } | null;
    teamId = meta?.team_id ?? undefined;
  } catch {
    return NextResponse.json({ ok: true, broken: false, reason: "no_vercel" });
  }

  // Latest deployment status. Only diagnose when it actually failed.
  const status = await getLatestDeploymentStatus({
    token,
    projectId: project.vercel_project_id as string,
    teamId,
  });

  if (status.state !== "ERROR" || !status.deploymentId) {
    return NextResponse.json({ ok: true, broken: false });
  }

  // Pull the failed build's key error line, then explain it (heuristic-first,
  // cheap LLM only for unknown errors; explainDeployError never throws).
  const errorLine = await getDeploymentErrorLine({
    token,
    deploymentId: status.deploymentId,
    teamId,
  });

  const explanation = await explainDeployError(
    errorLine ?? "The deploy failed but no specific error line was found in the build log.",
  );

  return NextResponse.json({
    ok: true,
    broken: true,
    whatBroke: explanation.whatBroke,
    nextStep: explanation.nextStep,
    fixPrompt: explanation.fixPrompt,
    errorLine: errorLine ?? null,
  });
}
