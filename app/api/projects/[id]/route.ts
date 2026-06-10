import { decrypt } from "@/lib/crypto";
import { renameRepo } from "@/lib/github";
import { projectLimit } from "@/lib/plan";
import { fixMojibake, MAX_BUILD_PROMPT } from "@/lib/text";
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

  const { data: planRow } = await supabase
    .from("profiles").select("plan, phone, marketing_consent, bonus_projects").eq("id", user.id).single();

  const { data: project } = await supabase
    .from("projects")
    .select("vercel_project_id, supabase_project_ref, status")
    .eq("id", id).eq("user_id", user.id).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // A user who is OVER their current limit (e.g. a lapsed Core/Pro now on free,
  // still holding more projects than free allows) must be able to shed the
  // excess — otherwise they're trapped (can't delete, can't create). Count live
  // projects and compare to their limit.
  const { count: ownedCount } = await supabase
    .from("projects").select("*", { count: "exact", head: true })
    .eq("user_id", user.id).not("status", "in", "(failed,provisioning)");
  const overLimit = (ownedCount ?? 0) > projectLimit(planRow?.plan, planRow?.bonus_projects ?? 0, planRow);

  // Free users can't delete (anti-recycle); Core/Pro can. Exceptions: a 'failed'
  // project never consumed a real slot, and an over-limit user must be able to
  // free a slot to get unstuck.
  if (planRow?.plan !== "pro" && planRow?.plan !== "core" && project.status !== "failed" && !overLimit) {
    return NextResponse.json(
      { error: "Free projects can't be deleted — upgrade to Core to delete and recreate projects.", code: "delete_locked" },
      { status: 403 },
    );
  }

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
    plan_progress?: unknown;
    track?: string;
    showcase_published?: boolean;
    showcase_image?: string | null;
  };

  const updates: Record<string, string> = {};

  // Plan progress (array of completed Now-task labels) — saved on its own since
  // it's a jsonb array, not a string field.
  if (Array.isArray(body.plan_progress)) {
    const prog = (body.plan_progress as unknown[]).filter((s) => typeof s === "string").slice(0, 200);
    const { error } = await supabase.from("projects")
      .update({ plan_progress: prog }).eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "Couldn't save progress" }, { status: 500 });
  }

  // Showcase publish toggle + custom thumbnail — saved on their own (boolean / nullable).
  if (typeof body.showcase_published === "boolean" || body.showcase_image !== undefined) {
    const su: Record<string, unknown> = {};
    if (typeof body.showcase_published === "boolean") su.showcase_published = body.showcase_published;
    if (body.showcase_image !== undefined) {
      if (body.showcase_image) {
        // Only accept thumbnails we host ourselves (the public `showcase` bucket),
        // mirroring the avatar_url check — the host must match our Supabase origin
        // so a caller can't store an arbitrary off-site URL.
        const raw = String(body.showcase_image).slice(0, 500);
        let ok = false;
        try {
          const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
          ok = new URL(raw).origin === supabaseOrigin;
        } catch { ok = false; }
        if (!ok) {
          return NextResponse.json(
            { error: "Showcase image must be an uploaded image." },
            { status: 400 },
          );
        }
        su.showcase_image = raw;
      } else {
        su.showcase_image = null;
      }
    }
    const { error } = await supabase.from("projects").update(su).eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "Couldn't update showcase settings" }, { status: 500 });
  }

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
    // Repair mojibake, then cap generously (a real PRD/plan is tens of KB — the
    // old 2000-char cap truncated uploaded plans).
    updates.build_prompt = fixMojibake(body.build_prompt).slice(0, MAX_BUILD_PROMPT);
  }

  if (body.track !== undefined) {
    updates.track = String(body.track).slice(0, 40);
  }

  if (Object.keys(updates).length === 0) {
    if (Array.isArray(body.plan_progress) || typeof body.showcase_published === "boolean" || body.showcase_image !== undefined) {
      return NextResponse.json({ ok: true });
    }
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
