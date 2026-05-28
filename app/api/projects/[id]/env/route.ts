import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { listVercelEnvVars, upsertVercelEnvVar } from "@/lib/vercel";
import { NextResponse } from "next/server";

/** Load the caller's project + decrypted Vercel token, or return an error response. */
async function loadCtx(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: project } = await supabase
    .from("projects").select("id, vercel_project_id")
    .eq("id", id).eq("user_id", user.id).single();
  if (!project?.vercel_project_id) {
    return { error: NextResponse.json({ error: "No Vercel project linked" }, { status: 400 }) };
  }

  const { data: conn } = await supabase
    .from("oauth_connections").select("access_token, metadata")
    .eq("user_id", user.id).eq("provider", "vercel").single();
  if (!conn) return { error: NextResponse.json({ error: "Vercel not connected" }, { status: 400 }) };

  const token = await decrypt(conn.access_token as string);
  const meta = conn.metadata as { team_id?: string | null } | null;
  return { token, teamId: meta?.team_id ?? undefined, projectId: project.vercel_project_id as string };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadCtx(id);
  if ("error" in ctx) return ctx.error;
  const envs = await listVercelEnvVars(ctx);
  return NextResponse.json({ envs });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadCtx(id);
  if ("error" in ctx) return ctx.error;

  const body = await req.json() as { key?: string; value?: string };
  const key = body.key?.trim();
  const value = body.value;
  if (!key || !/^[A-Z0-9_]+$/i.test(key) || typeof value !== "string" || value.length === 0) {
    return NextResponse.json({ error: "Provide a valid KEY and a non-empty value." }, { status: 400 });
  }

  try {
    await upsertVercelEnvVar({ ...ctx, key, value });
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to set env var" },
      { status: 500 },
    );
  }
}
