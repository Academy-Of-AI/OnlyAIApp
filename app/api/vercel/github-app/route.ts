import { decrypt } from "@/lib/crypto";
import { getVercelGithubAppStatus } from "@/lib/vercel";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/vercel/github-app — is the Vercel GitHub app actually installed?
 *
 * Powers the get-started checklist's "Give Vercel access to your repos" step
 * with a REAL signal instead of a "user clicked the link" guess. Connecting
 * Vercel via OAuth doesn't install the GitHub app; without it the first
 * provision fails with "install the GitHub integration first". We ask Vercel
 * whether it can reach the user's GitHub (git-namespaces) — empty ⇒ not
 * installed. Returns:
 *   { connected: false }                         — Vercel not connected yet
 *   { connected: true, installed, requireReauth} — connected; install state
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conn } = await supabase
    .from("oauth_connections")
    .select("access_token, metadata")
    .eq("user_id", user.id)
    .eq("provider", "vercel")
    .maybeSingle();

  if (!conn?.access_token) {
    return NextResponse.json({ connected: false, installed: false, requireReauth: false });
  }

  // Authoritative proof — if the user has EVER successfully created a Vercel
  // project (vercel_project_id set on any of their builds, archived or not), the
  // Vercel GitHub app MUST be installed: createVercelProject can't succeed
  // otherwise. This is reliable even when the Marketplace integration token lacks
  // the scope to read git-namespaces (which returns empty and would falsely read
  // "not installed" — the bug that left the step unchecked for a correctly
  // installed user).
  const { data: proof } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", user.id)
    .not("vercel_project_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (proof) {
    return NextResponse.json({ connected: true, installed: true, requireReauth: false, via: "project" });
  }

  // No prior Vercel project yet — ask Vercel directly (best-effort). If the token
  // can't read git-namespaces this comes back not-installed, and the checklist
  // shows honest "we'll confirm on your first build" copy rather than a false green.
  const token = await decrypt(conn.access_token as string);
  const teamId = (conn.metadata as { team_id?: string | null } | null)?.team_id ?? undefined;
  const status = await getVercelGithubAppStatus({ token, teamId });
  return NextResponse.json({ connected: true, ...status, via: "namespaces" });
}
