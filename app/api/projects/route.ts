import { decrypt } from "@/lib/crypto";
import { provisionProject, type ProgressEvent } from "@/lib/provisioning";
import { createClient } from "@/lib/supabase/server";
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

  // Check plan limits (free = 3 projects)
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
    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: "Free plan limit reached (3 projects). Upgrade to Pro." },
        { status: 403 },
      );
    }
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

  if (!githubConn) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }
  if (!vercelConn) {
    return NextResponse.json({ error: "Vercel not connected" }, { status: 400 });
  }

  const githubToken = await decrypt(githubConn.access_token as string);
  const vercelToken = await decrypt(vercelConn.access_token as string);

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
          },
          (progressEvent: ProgressEvent) => send(progressEvent),
        );

        // Update project to deployed
        await supabase
          .from("projects")
          .update({
            status: "deployed",
            github_repo_url: result.githubRepoUrl,
            vercel_project_id: result.vercelProjectId,
            vercel_preview_url: result.vercelPreviewUrl,
            supabase_project_ref: result.supabaseProjectRef ?? null,
            deployed_at: new Date().toISOString(),
          })
          .eq("id", project.id);

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
