import { decrypt } from "@/lib/crypto";
import { provisionProject } from "@/lib/provisioning";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/hackathons/join
 * Body: { inviteCode: string }
 *
 * Joins a hackathon AND auto-provisions a project for the user.
 * Requires GitHub + Vercel to be connected.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteCode, projectName: requestedName } = await request.json() as {
    inviteCode: string;
    projectName?: string;   // optional — user-chosen name; auto-generated if omitted
  };
  if (!inviteCode?.trim()) {
    return NextResponse.json({ error: "Invite code required" }, { status: 400 });
  }

  // Find hackathon
  const { data: hackathon } = await supabase
    .from("hackathons")
    .select("*")
    .eq("invite_code", inviteCode.toUpperCase())
    .eq("status", "active")
    .single();

  if (!hackathon) {
    return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 404 });
  }

  // Check capacity
  const { count } = await supabase
    .from("hackathon_participants")
    .select("*", { count: "exact", head: true })
    .eq("hackathon_id", hackathon.id);

  if ((count ?? 0) >= hackathon.max_participants) {
    return NextResponse.json({ error: "Hackathon is full" }, { status: 409 });
  }

  // Check already joined
  const { data: existing } = await supabase
    .from("hackathon_participants")
    .select("id, project_id, projects(github_repo_url, vercel_preview_url)")
    .eq("hackathon_id", hackathon.id)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({
      alreadyJoined: true,
      project: existing.projects,
    });
  }

  // Load tokens
  const { data: connections } = await supabase
    .from("oauth_connections")
    .select("provider, access_token")
    .eq("user_id", user.id)
    .in("provider", ["github", "vercel"]);

  const githubConn = connections?.find((c) => c.provider === "github");
  const vercelConn = connections?.find((c) => c.provider === "vercel");

  if (!githubConn || !vercelConn) {
    return NextResponse.json(
      { error: "Connect GitHub and Vercel before joining", needsConnect: true },
      { status: 400 },
    );
  }

  const githubToken = await decrypt(githubConn.access_token);
  const vercelToken = await decrypt(vercelConn.access_token);

  // Use caller-supplied name or fall back to auto-generated slug
  const { data: profile } = await supabase
    .from("profiles").select("github_username").eq("id", user.id).single();

  let projectName: string;
  if (requestedName && /^[a-z0-9-]{3,40}$/.test(requestedName)) {
    projectName = requestedName;
  } else {
    // Auto-generate: hackathon-slug-githubusername
    const hackathonSlug = hackathon.name.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20);
    const userSlug = (profile?.github_username ?? user.id.slice(0, 6)).toLowerCase().replace(/[^a-z0-9]/g, "-");
    projectName = `${hackathonSlug}-${userSlug}`.slice(0, 40);
  }

  // Verify the name isn't already taken by this user
  const { data: nameTaken } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", projectName)
    .single();

  if (nameTaken) {
    return NextResponse.json(
      { error: `Project name "${projectName}" is already taken. Choose a different name.` },
      { status: 409 },
    );
  }

  // Create project record
  const { data: project } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: projectName,
      template_id: hackathon.template_id,
      status: "provisioning",
    })
    .select()
    .single();

  if (!project) {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  // Insert participant record
  await supabase.from("hackathon_participants").insert({
    hackathon_id: hackathon.id,
    user_id: user.id,
    project_id: project.id,
  });

  // Provision
  try {
    const result = await provisionProject({ projectName, githubToken, vercelToken }, () => {});

    await supabase.from("projects").update({
      status: "deployed",
      github_repo_url: result.githubRepoUrl,
      vercel_project_id: result.vercelProjectId,
      vercel_preview_url: result.vercelPreviewUrl,
      deployed_at: new Date().toISOString(),
    }).eq("id", project.id);

    await supabase.from("events").insert({
      user_id: user.id,
      event: "hackathon_joined",
      properties: { hackathonId: hackathon.id, projectId: project.id },
    });

    return NextResponse.json({
      hackathon: { id: hackathon.id, name: hackathon.name },
      githubRepoUrl: result.githubRepoUrl,
      vercelPreviewUrl: result.vercelPreviewUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provisioning failed";
    await supabase.from("projects")
      .update({ status: "failed", error: message })
      .eq("id", project.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
