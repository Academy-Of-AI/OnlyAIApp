import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/plan";
import { upsertVercelEnvVar } from "@/lib/vercel";
import { NextResponse } from "next/server";

// Only these env keys may be written (bring-your-own-key integrations).
const ALLOWED = new Set([
  "SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_POSTHOG_KEY", "NEXT_PUBLIC_POSTHOG_HOST",
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
]);

/** POST /api/projects/:id/integration — inject a user's own integration keys into their app's Vercel env (Pro). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isProUser(supabase, user.id))) {
    return NextResponse.json({ error: "Integrations are a Pro feature.", code: "pro_required" }, { status: 403 });
  }

  const { values } = (await request.json().catch(() => ({}))) as { values?: Record<string, string> };
  const entries = Object.entries(values ?? {}).filter(
    ([k, v]) => ALLOWED.has(k) && typeof v === "string" && v.trim().length > 0,
  );
  if (entries.length === 0) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  const { data: project } = await supabase
    .from("projects").select("vercel_project_id").eq("id", id).eq("user_id", user.id).single();
  if (!project?.vercel_project_id) {
    return NextResponse.json({ error: "Deploy this project first, then add integrations." }, { status: 400 });
  }

  const { data: conn } = await supabase
    .from("oauth_connections").select("access_token, metadata").eq("user_id", user.id).eq("provider", "vercel").single();
  if (!conn) return NextResponse.json({ error: "Connect Vercel first (Settings)." }, { status: 400 });

  try {
    const token = await decrypt(conn.access_token as string);
    const teamId = (conn.metadata as { team_id?: string | null } | null)?.team_id ?? undefined;
    for (const [key, value] of entries) {
      await upsertVercelEnvVar({ token, projectId: project.vercel_project_id as string, key, value: value.trim(), teamId });
    }
    return NextResponse.json({ ok: true, saved: entries.map(([k]) => k) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save" }, { status: 400 });
  }
}
