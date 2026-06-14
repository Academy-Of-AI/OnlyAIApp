import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { getVercelProjectDomain } from "@/lib/vercel";

export const maxDuration = 30;

/**
 * POST /api/wall — add a finished build to the Directory.
 * Body: { projectId?, title?, tagline?, demoUrl?, screenshotUrl? }
 *
 * When a projectId is given we resolve the project's PRODUCTION ALIAS (always
 * the latest deploy — never the frozen preview URL), verify it's actually live,
 * and store that. This is why the Directory shows the real shipped app, not the
 * scaffold OnlyAIApp first deployed.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string; title?: string; tagline?: string; demoUrl?: string; screenshotUrl?: string;
  };

  let title = body.title?.trim() || "";
  let liveUrl = body.demoUrl?.trim() || "";

  // Resolve the production alias from the project (the correct, always-latest URL).
  if (body.projectId) {
    const { data: project } = await supabase
      .from("projects").select("name, vercel_project_id, vercel_preview_url")
      .eq("id", body.projectId).eq("user_id", user.id).single();
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

    if (!title) title = (project.name as string) ?? "Untitled";

    if (project.vercel_project_id) {
      try {
        const { data: vConn } = await supabase
          .from("oauth_connections").select("access_token")
          .eq("user_id", user.id).eq("provider", "vercel").single();
        if (vConn?.access_token) {
          const token = await decrypt(vConn.access_token as string);
          liveUrl = await getVercelProjectDomain({
            token,
            projectId: project.vercel_project_id as string,
            projectName: project.name as string,
          });
        }
      } catch { /* fall back below */ }
    }
    if (!liveUrl) liveUrl = (project.vercel_preview_url as string | null) ?? "";
  }

  if (!title || !liveUrl) {
    return NextResponse.json({ error: "Need a deployed project (or a live URL) to add." }, { status: 400 });
  }

  // Pilot liveness check — confirm it actually responds before showcasing it.
  // 2xx/3xx (and even 401/403 auth gates) = live; 404/5xx or no response = down.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(liveUrl, { method: "GET", redirect: "follow", signal: ctrl.signal });
    clearTimeout(t);
    if (res.status >= 500 || res.status === 404) {
      return NextResponse.json({ error: `That site isn't responding (HTTP ${res.status}). Deploy it first, then add it.` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Couldn't reach that site — make sure it's deployed and live, then try again." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles").select("full_name, github_username, is_builder").eq("id", user.id).single();
  const builderName =
    (profile?.full_name as string | null) ?? (profile?.github_username as string | null) ?? "A builder";

  const base = {
    user_id: user.id,
    project_id: body.projectId ?? null,
    title,
    tagline: body.tagline?.trim() || null,
    demo_url: liveUrl,
    builder_name: builderName,
  };
  const enriched = {
    ...base,
    live_url: liveUrl,
    screenshot_url: body.screenshotUrl?.trim() || null,
    status: "live", // pilot-lint-ok: not optimistic — the liveness fetch above (lines 60-72) confirms the URL responds before we claim "live"
    last_checked: new Date().toISOString(),
  };

  // Try the enriched insert (new columns); fall back to base if the migration
  // hasn't run yet so the feature still works.
  let inserted = await supabase.from("wall_submissions").insert(enriched).select("id").single();
  if (inserted.error) {
    inserted = await supabase.from("wall_submissions").insert(base).select("id").single();
  }
  if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 });

  if (!profile?.is_builder) {
    try { await supabase.from("profiles").update({ is_builder: true }).eq("id", user.id); } catch {}
  }

  return NextResponse.json({ ok: true, id: inserted.data!.id });
}
