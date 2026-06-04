import { decrypt } from "@/lib/crypto";
import { registerPushWebhook, getCommitIdentity } from "@/lib/github";
import { provisionProject, type ProgressEvent } from "@/lib/provisioning";
import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";
import { NextResponse } from "next/server";

export const maxDuration = 300;

/**
 * GET /api/projects — list current user's projects
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/projects — provision a new project (streams SSE progress)
 * Body: { name, templateId?, supabaseUrl?, supabaseAnonKey? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    name: string;
    templateId?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  };

  const { name, templateId = "vibe-stack-supabase", supabaseUrl, supabaseAnonKey } = body;

  if (!name?.match(/^[a-z0-9-]{3,40}$/)) {
    return NextResponse.json(
      { error: "Name must be 3–40 lowercase letters, numbers, or hyphens" },
      { status: 400 },
    );
  }

  // Check plan limits (free = 1 project)
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan === "free") {
    const { count } = await supabase
      .from("projects")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= 1) {
      return NextResponse.json(
        { error: "Free plan includes 1 project. Upgrade to Pro for unlimited projects.", code: "plan_limit" },
        { status: 403 },
      );
    }
  }

  // Hard ceiling (all plans): every project provisions its OWN Supabase project,
  // so cap the total to stay under the Supabase org limit. Tune with MAX_PROJECTS.
  const MAX_PROJECTS = parseInt(process.env.MAX_PROJECTS ?? "8", 10);
  const { count: totalProjects } = await supabase
    .from("projects").select("*", { count: "exact", head: true }).eq("user_id", user.id);
  if ((totalProjects ?? 0) >= MAX_PROJECTS) {
    return NextResponse.json(
      {
        error: `You've reached the project limit (${MAX_PROJECTS}). Each project gets its own Supabase database, so this keeps you under your Supabase org's limit. Delete one you don't need, or raise MAX_PROJECTS after upgrading Supabase.`,
        code: "project_limit",
      },
      { status: 403 },
    );
  }

  // Load GitHub + Vercel + Supabase (optional) connections
  const { data: connections } = await supabase
    .from("oauth_connections")
    .select("provider, access_token, metadata")
    .eq("user_id", user.id)
    .in("provider", ["github", "vercel", "supabase", "resend"]);

  const githubConn = connections?.find((c) => c.provider === "github");
  const vercelConn = connections?.find((c) => c.provider === "vercel");
  const supabaseConn = connections?.find((c) => c.provider === "supabase");

  // GitHub is the only requirement for the onramp. Vercel/Supabase are optional —
  // a newbie gets a repo + Claude Code now, and connects deploy/db later.
  if (!githubConn) {
    return NextResponse.json({ error: "Connect GitHub to create a project." }, { status: 400 });
  }

  const githubToken = await decrypt(githubConn.access_token as string);
  const vercelToken = vercelConn ? await decrypt(vercelConn.access_token as string) : undefined;

  const resendConn   = connections?.find((c) => c.provider === "resend");

  let supabaseToken: string | undefined;
  let supabaseOrgId: string | undefined;
  let resendApiKey:  string | undefined;

  if (supabaseConn) {
    supabaseToken = await decrypt(supabaseConn.access_token as string);
    const meta = supabaseConn.metadata as { org_id?: string } | null;
    supabaseOrgId = meta?.org_id;
  }

  if (resendConn) {
    resendApiKey = await decrypt(resendConn.access_token as string);
  }

  // Insert project record as provisioning
  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      template_id: templateId,
      status: "provisioning",
    })
    .select()
    .single();

  if (insertError || !project) {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  // Stream SSE progress back to the client
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const tpl = getTemplate(templateId);
        const result = await provisionProject(
          {
            projectName: name,
            githubToken,
            vercelToken,
            supabaseToken,
            supabaseOrgId,
            supabaseUrl,
            supabaseAnonKey,
            resendApiKey,
            templateOwner: tpl.owner,
            templateRepo: tpl.repo,
          },
          (progressEvent: ProgressEvent) => send(progressEvent),
        );

        // Update project to deployed
        await supabase
          .from("projects")
          .update({
            status: result.vercelProjectId ? "deployed" : "ready",
            github_repo_url: result.githubRepoUrl,
            vercel_project_id: result.vercelProjectId ?? null,
            vercel_preview_url: result.vercelPreviewUrl ?? null,
            supabase_project_ref: result.supabaseProjectRef ?? null,
            deployed_at: new Date().toISOString(),
          })
          .eq("id", project.id);

        // Pilot (anchor & monitor): default-on auto-capture for new projects. Register
        // the push webhook + flip the flag so Plan / On-track / What-it-knows
        // start working automatically. Best-effort — never fail provisioning.
        try {
          const repoMatch = result.githubRepoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get("origin") ?? "";
          if (repoMatch && appUrl) {
            await registerPushWebhook({
              token: githubToken,
              owner: repoMatch[1],
              repo: repoMatch[2].replace(/\.git$/, ""),
              callbackUrl: `${appUrl}/api/github/webhook`,
              secret: process.env.GITHUB_WEBHOOK_SECRET,
            });
            await supabase.from("projects").update({ auto_capture: true }).eq("id", project.id);
          }
        } catch (e) {
          console.warn("[provision] default-on auto-capture failed (non-fatal):", e);
        }

        // The git identity the handed-off project must commit with so Vercel
        // doesn't block deploys ("commit email could not be matched to a GitHub
        // account"). Best-effort — never fail provisioning over it.
        let commitEmail: string | undefined;
        let commitName: string | undefined;
        try {
          const ident = await getCommitIdentity(githubToken);
          commitEmail = ident.email;
          commitName = ident.name;
        } catch (e) {
          console.warn("[provision] commit identity lookup failed (non-fatal):", e);
        }

        // Track event
        await supabase.from("events").insert({
          user_id: user.id,
          event: "project_provisioned",
          properties: { projectId: project.id, templateId, name },
        });

        send({
          step: "done",
          result: {
            id: project.id,
            githubRepoUrl: result.githubRepoUrl,
            vercelPreviewUrl: result.vercelPreviewUrl,
            supabaseProjectRef: result.supabaseProjectRef,
            commitEmail,
            commitName,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";

        await supabase
          .from("projects")
          .update({ status: "failed", error: message })
          .eq("id", project.id);

        send({ step: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
