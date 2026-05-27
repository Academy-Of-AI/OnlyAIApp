import { decrypt } from "@/lib/crypto";
import { provisionProject } from "@/lib/provisioning";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/projects — list current user's projects
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/projects — provision a new project
 * Body: { name, templateId?, supabaseUrl?, supabaseAnonKey? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  // Load GitHub + Vercel tokens
  const { data: connections } = await supabase
    .from("oauth_connections")
    .select("provider, access_token")
    .eq("user_id", user.id)
    .in("provider", ["github", "vercel"]);

  const githubConn = connections?.find((c) => c.provider === "github");
  const vercelConn = connections?.find((c) => c.provider === "vercel");

  if (!githubConn) {
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });
  }
  if (!vercelConn) {
    return NextResponse.json({ error: "Vercel not connected" }, { status: 400 });
  }

  const githubToken = await decrypt(githubConn.access_token);
  const vercelToken = await decrypt(vercelConn.access_token);

  // Insert project record as pending
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

  // Provision (async — runs during the request; for heavy load move to a queue)
  try {
    const result = await provisionProject({
      projectName: name,
      githubToken,
      vercelToken,
      supabaseUrl,
      supabaseAnonKey,
    });

    await supabase
      .from("projects")
      .update({
        status: "deployed",
        github_repo_url: result.githubRepoUrl,
        vercel_project_id: result.vercelProjectId,
        vercel_preview_url: result.vercelPreviewUrl,
        deployed_at: new Date().toISOString(),
      })
      .eq("id", project.id);

    // Track event
    await supabase.from("events").insert({
      user_id: user.id,
      event: "project_provisioned",
      properties: { projectId: project.id, templateId, name },
    });

    return NextResponse.json({
      id: project.id,
      githubRepoUrl: result.githubRepoUrl,
      vercelPreviewUrl: result.vercelPreviewUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("projects")
      .update({ status: "failed", error: message })
      .eq("id", project.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
