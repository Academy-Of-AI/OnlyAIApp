import { decrypt } from "@/lib/crypto";
import { getProjectKeys } from "@/lib/supabase-mgmt";
import { addVercelEnvVars, createVercelProject, getVercelProjectDomain, triggerVercelDeployment } from "@/lib/vercel";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * POST /api/projects/:id/deploy — the one-click "Go live" for a `ready` project.
 *
 * The READY→LIVE gap was the #1 launch blocker (0/7 personas reached a live
 * app): free users got a repo + plan but the only deploy path was a terminal.
 * This closes it in-product: with a connected Vercel account it creates the
 * Vercel project from the EXISTING GitHub repo, injects env vars, triggers the
 * first build, and flips the project to `deployed` with a live URL — the exact
 * machinery provisioning already runs for Vercel-connected users.
 *
 * No plan gate: going live is the core promise, free tier included.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.github_repo_url) {
    return NextResponse.json({ error: "Finish provisioning first — this project has no repo yet." }, { status: 400 });
  }

  // Vercel connection is the only requirement. Without it, tell the UI to show
  // the connect form (code vercel_required), not a dead-end error.
  const { data: vConn } = await supabase
    .from("oauth_connections").select("access_token")
    .eq("user_id", user.id).eq("provider", "vercel").single();
  if (!vConn?.access_token) {
    return NextResponse.json(
      { error: "Connect Vercel (free) to put this app live.", code: "vercel_required" },
      { status: 400 },
    );
  }

  let vercelToken: string;
  try { vercelToken = await decrypt(vConn.access_token as string); }
  catch { return NextResponse.json({ error: "Your Vercel connection looks corrupted — reconnect Vercel and try again.", code: "vercel_required" }, { status: 400 }); }

  try {
    // Already has a Vercel project (e.g. an earlier deploy) — just re-trigger.
    if (project.vercel_project_id) {
      await triggerVercelDeployment({
        token: vercelToken,
        projectId: project.vercel_project_id as string,
        projectName: project.name as string,
      });
      const domain = await getVercelProjectDomain({
        token: vercelToken,
        projectId: project.vercel_project_id as string,
        projectName: project.name as string,
      });
      await supabase.from("projects")
        .update({ vercel_preview_url: domain, status: "deployed", error: null })
        .eq("id", id);
      return NextResponse.json({ ok: true, liveUrl: domain, redeploy: true });
    }

    // First deploy: create the Vercel project FROM the existing repo (same flow
    // provisioning runs when a Vercel token is present).
    const repoMatch = (project.github_repo_url as string).match(/github\.com\/([^/]+\/[^/?#]+)/);
    const repoFullName = repoMatch ? repoMatch[1].replace(/\.git$/, "") : null;
    if (!repoFullName) return NextResponse.json({ error: "Couldn't read this project's GitHub repo URL." }, { status: 400 });

    const { projectId: vercelProjectId } = await createVercelProject({
      token: vercelToken,
      name: project.name as string,
      githubRepoFullName: repoFullName,
    });

    const domain = await getVercelProjectDomain({
      token: vercelToken,
      projectId: vercelProjectId,
      projectName: project.name as string,
    });

    // Wire env vars: app URL always; Supabase keys when the project has a
    // database and the user has a Supabase connection (best-effort).
    const envVars: Record<string, string> = { NEXT_PUBLIC_APP_URL: domain };
    if (project.supabase_project_ref) {
      try {
        const { data: sConn } = await supabase
          .from("oauth_connections").select("access_token")
          .eq("user_id", user.id).eq("provider", "supabase").single();
        if (sConn?.access_token) {
          const sToken = await decrypt(sConn.access_token as string);
          const keys = await getProjectKeys(sToken, project.supabase_project_ref as string);
          envVars["NEXT_PUBLIC_SUPABASE_URL"] = keys.projectUrl;
          envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = keys.anonKey;
        }
      } catch { /* non-fatal — deploy still proceeds; keys can be added later */ }
    }
    await addVercelEnvVars({ token: vercelToken, projectId: vercelProjectId, envVars });

    // Kick the first build (linking alone doesn't always trigger one).
    await triggerVercelDeployment({ token: vercelToken, projectId: vercelProjectId, projectName: project.name as string }).catch(() => {});

    await supabase.from("projects")
      .update({ vercel_project_id: vercelProjectId, vercel_preview_url: domain, status: "deployed", error: null })
      .eq("id", id);

    return NextResponse.json({ ok: true, liveUrl: domain });
  } catch (err) {
    console.error("[deploy] error:", err);
    const e = err as { status?: number; message?: string };
    const raw = (e?.message ?? "").toLowerCase();
    if (e?.status === 401 || e?.status === 403 || /forbidden|not authorized|invalid token/.test(raw)) {
      return NextResponse.json(
        { error: "Vercel rejected the connection — your token may have expired. Reconnect Vercel and try again.", code: "vercel_required" },
        { status: 400 },
      );
    }
    if (e?.status === 409 || /already exists|conflict/.test(raw)) {
      return NextResponse.json(
        { error: `A Vercel project named "${project.name}" already exists on your account — delete or rename it on vercel.com, then try again.` },
        { status: 409 },
      );
    }
    // Vercel can't see/link the GitHub repo unless the Vercel GitHub app is
    // installed on it — common for a brand-new Vercel user who only made a token.
    if (/git repository|repository was not found|installation|github app|not connected to git|unable to link|could not.*link/i.test(raw)) {
      return NextResponse.json(
        { error: "Vercel couldn't link your GitHub repo. Install the Vercel GitHub app on it (vercel.com → Add New… → Project → Import your repo once), then try again — or just push to GitHub and Vercel deploys automatically.", code: "vercel_github_app" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Couldn't start the deploy — please try again in a moment." }, { status: 500 });
  }
}
