import { decrypt } from "@/lib/crypto";
import { githubClient } from "@/lib/github";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const maxDuration = 20;

/**
 * GET /api/repo-health/repos — the user's own GitHub repos, for the health-read
 * picker. Read-only: lists repos the user owns (newest-pushed first) so they can
 * point the Pilot at an existing project. Never touches a repo's contents here.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conn } = await supabase
    .from("oauth_connections").select("access_token")
    .eq("user_id", user.id).eq("provider", "github").maybeSingle();
  if (!conn?.access_token) {
    return NextResponse.json({ error: "GitHub not connected", code: "github_required" }, { status: 400 });
  }

  let token: string;
  try { token = await decrypt(conn.access_token as string); }
  catch { return NextResponse.json({ error: "Your GitHub connection looks corrupted — reconnect GitHub.", code: "github_required" }, { status: 400 }); }

  try {
    const gh = githubClient(token);
    const { data } = await gh.repos.listForAuthenticatedUser({
      sort: "pushed", direction: "desc", per_page: 100, affiliation: "owner,collaborator,organization_member",
    });
    const repos = data.map((r) => ({
      fullName: r.full_name,
      private: r.private,
      language: r.language ?? null,
      pushedAt: r.pushed_at ?? null,
      description: r.description ?? null,
    }));
    return NextResponse.json({ ok: true, repos });
  } catch {
    return NextResponse.json({ error: "Couldn't list your GitHub repos — try reconnecting GitHub." }, { status: 502 });
  }
}
