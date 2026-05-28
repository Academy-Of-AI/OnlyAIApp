import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { getLatestDeploymentStatus, type DeploymentState } from "@/lib/vercel";
import Link from "next/link";

export const dynamic = "force-dynamic";

/* Map live Vercel state → pill styling + label */
const STATE_UI: Record<DeploymentState, { label: string; cls: string; dot: string }> = {
  READY:        { label: "Live",        cls: "bg-green-500/15 text-green-400",  dot: "bg-green-400" },
  BUILDING:     { label: "Building",    cls: "bg-amber-500/15 text-amber-400",  dot: "bg-amber-400" },
  INITIALIZING: { label: "Building",    cls: "bg-amber-500/15 text-amber-400",  dot: "bg-amber-400" },
  QUEUED:       { label: "Queued",      cls: "bg-amber-500/15 text-amber-400",  dot: "bg-amber-400" },
  ERROR:        { label: "Broken",      cls: "bg-red-500/15 text-red-400",      dot: "bg-red-400" },
  CANCELED:     { label: "Canceled",    cls: "bg-neutral-500/15 text-neutral-400", dot: "bg-neutral-400" },
  unknown:      { label: "No deploy",   cls: "bg-neutral-500/15 text-neutral-400", dot: "bg-neutral-500" },
};

function timeAgo(ms: number | null): string {
  if (!ms) return "";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function MissionControlPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: projects }, { data: vercelConn }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("oauth_connections").select("access_token, metadata")
      .eq("user_id", user!.id).eq("provider", "vercel").single(),
  ]);

  // Decrypt Vercel token once; fetch live status for every linked project in parallel
  let vercelToken: string | null = null;
  let vercelTeamId: string | undefined;
  if (vercelConn) {
    try {
      vercelToken = await decrypt(vercelConn.access_token as string);
      const meta = vercelConn.metadata as { team_id?: string | null } | null;
      vercelTeamId = meta?.team_id ?? undefined;
    } catch { /* token unreadable — fall back to stored status */ }
  }

  const statuses = await Promise.all(
    (projects ?? []).map(async (p) => {
      if (!vercelToken || !p.vercel_project_id) return null;
      return getLatestDeploymentStatus({
        token: vercelToken,
        projectId: p.vercel_project_id as string,
        teamId: vercelTeamId,
      });
    }),
  );

  const live = (projects ?? []).map((p, i) => ({ project: p, status: statuses[i] }));
  const broken = live.filter((x) => x.status?.state === "ERROR").length;

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mission Control</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {live.length} project{live.length !== 1 ? "s" : ""}
            {broken > 0 && <span className="text-red-400"> · {broken} broken</span>}
            {" "}· live status from Vercel
          </p>
        </div>
        <Link href="/new-project"
          className="bg-green-500 hover:bg-green-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + New project
        </Link>
      </div>

      {!live.length ? (
        <div className="text-center py-24 text-neutral-500 space-y-2">
          <p className="text-3xl">🚀</p><p>No projects yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {live.map(({ project: p, status }) => {
            const state: DeploymentState = status?.state ?? "unknown";
            const ui = STATE_UI[state];
            return (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="block border border-white/10 rounded-xl p-5 hover:border-white/25 hover:bg-white/[0.02] transition-all">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    {p.vercel_preview_url && (
                      <div className="text-[11px] font-mono text-neutral-600 truncate">
                        {p.vercel_preview_url.replace(/^https?:\/\//, "")}
                      </div>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${ui.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ui.dot}`} />{ui.label}
                  </span>
                </div>

                {status?.commitMessage && (
                  <p className="text-xs text-neutral-400 truncate">{status.commitMessage}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-neutral-600 mt-2">
                  {status?.createdAt && <span>Deploy {timeAgo(status.createdAt)}</span>}
                </div>

                {state === "ERROR" && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 text-xs text-red-300">
                    ⚠ Last deploy failed — open the project to see the build log.
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {!vercelToken && live.length > 0 && (
        <p className="text-xs text-neutral-600 text-center">
          Connect Vercel to see live deploy status.
        </p>
      )}
    </main>
  );
}
