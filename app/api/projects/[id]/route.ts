import { decrypt } from "@/lib/crypto";
import { renameRepo } from "@/lib/github";
import { createClient } from "@/lib/supabase/server";
import { renameVercelProject, deleteVercelProject } from "@/lib/vercel";
import { deleteSupabaseProject } from "@/lib/supabase-mgmt";
import { NextResponse } from "next/server";

/**
 * DELETE /api/projects/:id — remove the project + free its cloud resources.
 * Best-effort deletes the Vercel project and the Supabase project (so the slot
 * is freed under your Supabase org limit), then removes the row. The GitHub
 * repo is KEPT (your code) — delete it on GitHub if you want it gone.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Free users can't delete (anti-recycle); Core/Pro can.
  const { data: planRow } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (planRow?.plan !== "pro" && planRow?.plan !== "core") {
    return NextResponse.json(
      { error: "Free projects can't be deleted — upgrade to Core to delete and recreate projects.", code: "delete_locked" },
      { status: 403 },
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("vercel_project_id, supabase_project_ref")
    .eq("id", id).eq("user_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: conns } = await supabase
    .from("oauth_connections").select("provider, access_token")
    .eq("user_id", user.id).in("provider", ["vercel", "supabase"]);
  const vercelTok = conns?.find((c) => c.provider === "vercel")?.access_token;
  const supaTok = conns?.find((c) => c.provider === "supabase")?.access_token;

  if (project.vercel_project_id && vercelTok) {
    try { await deleteVercelProject({ token: await decrypt(vercelTok as string), projectId: project.vercel_project_id as string }); }
    catch (e) { console.warn("[delete] vercel cleanup failed (non-fatal):", e); }
  }
  if (project.supabase_project_ref && supaTok) {
    try { await deleteSupabaseProject(await decrypt(supaTok as string), project.supabase_project_ref as string); }
    catch (e) { console.warn("[delete] supabase cleanup failed (non-fatal):", e); }
  }

  const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/projects/:id — update editable project fields.
 * When `name` changes, also renames the GitHub repo and Vercel project
 * so the live URL stays in sync without any manual steps.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    name?: string;
    vercel_preview_url?: string;
    build_prompt?: string;
  };

  const updates: Record<string, string> = {};

  if (body.name !== undefined) {
    if (!body.name?.match(/^[a-z0-9-]{3,40}$/)) {
      return NextResponse.json(
        { error: "Name must be 3–40 lowercase letters, numbers, or hyphens" },
        { status: 400 },
      );
    }
    updates.name = body.name;
  }

  if (body.vercel_preview_url !== undefined) {
    const url = body.vercel_preview_url.trim();
    if (url && !url.startsWith("https://")) {
      return NextResponse.json(
        { error: "URL must start with https://" },
        { status: 400 },
      );
    }
    updates.vercel_preview_url = url;
  }

  if (body.build_prompt !== undefined) {
    updates.build_prompt = body.build_prompt.slice(0, 2000);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  /* ── When name changes, sync GitHub repo + Vercel project ───────────── */
  if (updates.name) {
    // Load current project to get old repo URL and Vercel project ID
    const { data: project } = await supabase
      .from("projects")
      .select("name, github_repo_url, vercel_project_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (project?.github_repo_url && project?.vercel_project_id) {
      // Parse owner/repo from the stored GitHub URL
      const match = project.github_repo_url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
      if (match) {
        const [, owner, rawRepo] = match;
        const oldRepo = rawRepo.replace(/\.git$/, "");

        // Load OAuth tokens in parallel
        const [{ data: githubConn }, { data: vercelConn }] = await Promise.all([
          supabase
            .from("oauth_connections")
            .select("access_token")
            .eq("user_id", user.id)
            .eq("provider", "github")
            .single(),
          supabase
            .from("oauth_connections")
            .select("access_token, metadata")
            .eq("user_id", user.id)
            .eq("provider", "vercel")
            .single(),
        ]);

        // Rename GitHub repo
        if (githubConn) {
          try {
            const githubToken = await decrypt(githubConn.access_token as string);
            const { repoUrl } = await renameRepo({
              token: githubToken,
              owner,
              repo: oldRepo,
              newName: updates.name,
            });
            updates.github_repo_url = repoUrl;
          } catch (err) {
            console.error("[patch] GitHub rename failed:", err);
            return NextResponse.json(
              { error: `GitHub rename failed: ${err instanceof Error ? err.message : String(err)}` },
              { status: 500 },
            );
          }
        }

        // Rename Vercel project + get the new domain
        if (vercelConn) {
          try {
            const vercelToken = await decrypt(vercelConn.access_token as string);
            const meta = vercelConn.metadata as { team_id?: string | null } | null;
            const teamId = meta?.team_id ?? undefined;
            const newDomain = await renameVercelProject({
              token: vercelToken,
              projectId: project.vercel_project_id as string,
              newName: updates.name,
              teamId,
            });
            // Only overwrite vercel_preview_url if the caller didn't supply one
            if (!updates.vercel_preview_url) {
              updates.vercel_preview_url = newDomain;
            }
          } catch (err) {
            // Non-fatal — GitHub was already renamed; log and continue
            console.error("[patch] Vercel rename failed (non-fatal):", err);
          }
        }
      }
    }
  }

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}
