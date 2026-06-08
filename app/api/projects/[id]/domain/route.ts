import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { canUseDomains } from "@/lib/plan";
import { addVercelDomain } from "@/lib/vercel";
import { NextResponse } from "next/server";

/** POST /api/projects/:id/domain — attach a custom domain to the project's Vercel app (Core + Pro). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: planRow } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (!canUseDomains(planRow?.plan)) {
    return NextResponse.json({ error: "Custom domains are available on Core & Pro.", code: "upgrade_required" }, { status: 403 });
  }

  const { domain } = (await request.json().catch(() => ({}))) as { domain?: string };
  const d = (domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) {
    return NextResponse.json({ error: "Enter a valid domain, e.g. app.yoursite.com" }, { status: 400 });
  }

  const { data: project } = await supabase
    .from("projects").select("vercel_project_id").eq("id", id).eq("user_id", user.id).single();
  if (!project?.vercel_project_id) {
    return NextResponse.json({ error: "Deploy this project first, then add a domain." }, { status: 400 });
  }

  const { data: conn } = await supabase
    .from("oauth_connections").select("access_token, metadata").eq("user_id", user.id).eq("provider", "vercel").single();
  if (!conn) return NextResponse.json({ error: "Connect Vercel first (Settings)." }, { status: 400 });

  try {
    const token = await decrypt(conn.access_token as string);
    const teamId = (conn.metadata as { team_id?: string | null } | null)?.team_id ?? undefined;
    const result = await addVercelDomain({ token, projectId: project.vercel_project_id as string, domain: d, teamId });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't add domain" }, { status: 400 });
  }
}
