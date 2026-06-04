import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { getDeploymentErrorLine, getLatestDeploymentStatus, type DeploymentState } from "@/lib/vercel";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATE_UI: Record<DeploymentState, { label: string; dot: string; chip: string }> = {
  READY:        { label: "Live",     dot: "bg-green-500",  chip: "border-green-500/30 text-green-400" },
  BUILDING:     { label: "Building", dot: "bg-amber-500",  chip: "border-amber-500/30 text-amber-400" },
  INITIALIZING: { label: "Building", dot: "bg-amber-500",  chip: "border-amber-500/30 text-amber-400" },
  QUEUED:       { label: "Queued",   dot: "bg-amber-500",  chip: "border-amber-500/30 text-amber-400" },
  ERROR:        { label: "Broken",   dot: "bg-red-500",    chip: "border-red-500/35 text-red-400" },
  CANCELED:     { label: "Canceled", dot: "bg-neutral-500", chip: "border-white/15 text-neutral-400" },
  unknown:      { label: "No deploy", dot: "bg-neutral-600", chip: "border-white/15 text-neutral-500" },
};

function timeAgo(ms: number | null): string {
  if (!ms) return "";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function PilotPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: projects }, { data: vercelConn }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("oauth_connections").select("access_token, metadata")
      .eq("user_id", user!.id).eq("provider", "vercel").single(),
  ]);

  let vercelToken: string | null = null;
  let vercelTeamId: string | undefined;
  if (vercelConn) {
    try {
      vercelToken = await decrypt(vercelConn.access_token as string);
      const meta = vercelConn.metadata as { team_id?: string | null } | null;
      vercelTeamId = meta?.team_id ?? undefined;
    } catch { /* fall back to stored status */ }
  }

  const statuses = await Promise.all(
    (projects ?? []).map(async (p) => {
      if (!vercelToken || !p.vercel_project_id) return null;
      return getLatestDeploymentStatus({ token: vercelToken, projectId: p.vercel_project_id as string, teamId: vercelTeamId });
    }),
  );
  const errorLines = await Promise.all(
    (projects ?? []).map(async (p, i) => {
      const s = statuses[i];
      if (!vercelToken || !s || s.state !== "ERROR" || !s.deploymentId) return null;
      return getDeploymentErrorLine({ token: vercelToken, deploymentId: s.deploymentId, teamId: vercelTeamId });
    }),
  );

  type Proj = {
    id: string; name: string;
    vercel_project_id: string | null; vercel_preview_url: string | null;
    last_digest: { onTrack?: boolean; note?: string } | null;
  };
  type Row = {
    project: Proj;
    status: Awaited<ReturnType<typeof getLatestDeploymentStatus>> | null;
    errorLine: string | null;
  };
  const rows: Row[] = ((projects ?? []) as Proj[]).map((p, i) => ({ project: p, status: statuses[i], errorLine: errorLines[i] }));

  const drifting = (p: Row["project"]) => {
    const d = p.last_digest as { onTrack?: boolean } | null;
    return d?.onTrack === false;
  };
  const needsAttention = rows.filter((r) => r.status?.state === "ERROR" || drifting(r.project));
  const onTrack = rows.filter((r) => !(r.status?.state === "ERROR" || drifting(r.project)));
  const broken = rows.filter((r) => r.status?.state === "ERROR").length;
  const building = rows.filter((r) => ["BUILDING", "QUEUED", "INITIALIZING"].includes(r.status?.state ?? "")).length;

  function Card({ r }: { r: Row }) {
    const p = r.project;
    const ui = STATE_UI[(r.status?.state ?? "unknown") as DeploymentState];
    const d = p.last_digest as { onTrack?: boolean; note?: string } | null;
    return (
      <Link href={`/projects/${p.id}`}
        className="block border border-white/10 rounded-xl p-4 hover:border-white/25 hover:bg-white/[0.02] transition-all">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ui.dot}`} />
            <div className="min-w-0">
              <p className="font-semibold truncate flex items-center gap-2">
                {p.name}
                <span className={`text-[10px] border px-1.5 py-0.5 rounded-full ${ui.chip}`}>{ui.label}</span>
              </p>
              {r.status?.commitMessage && <p className="text-xs text-neutral-500 truncate mt-0.5">{r.status.commitMessage}</p>}
            </div>
          </div>
          {r.status?.createdAt && <span className="text-[11px] text-neutral-600 shrink-0">{timeAgo(r.status.createdAt)}</span>}
        </div>
        {r.status?.state === "ERROR" && (
          <p className="mt-2 text-xs text-neutral-400"><span className="text-red-400">⚠</span> {r.errorLine ?? "Deploy failed — open to see the build log."}</p>
        )}
        {d?.onTrack === false && (
          <p className="mt-2 text-xs text-neutral-400"><span className="text-amber-400">⟲</span> Drifting{d.note ? `: ${d.note}` : ""}</p>
        )}
      </Link>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pilot — every OS, on course</h1>
          <p className="text-sm text-neutral-500 mt-1">Live health + drift across all your projects.</p>
        </div>
        <Link href="/new-project"
          className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          ＋ New project
        </Link>
      </div>

      {/* summary strip */}
      <div className="border border-white/10 rounded-xl px-4 py-3 flex items-center gap-x-6 gap-y-1 flex-wrap text-sm text-neutral-300">
        <span><b className="text-neutral-100">{rows.length}</b> <span className="text-neutral-500">OSes</span></span>
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{onTrack.length} on track</span>
        {building > 0 && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{building} building</span>}
        <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{broken} broken</span>
        {!vercelToken && <span className="text-neutral-600 ml-auto text-xs">Connect Vercel for live status</span>}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-24 text-neutral-500 space-y-2 border border-white/10 rounded-2xl"><p className="text-3xl">🛫</p><p>No projects yet.</p></div>
      ) : (
        <div className="space-y-6">
          {needsAttention.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Needs attention</p>
              <div className="grid sm:grid-cols-2 gap-3">{needsAttention.map((r) => <Card key={r.project.id} r={r} />)}</div>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">On track</p>
            <div className="grid sm:grid-cols-2 gap-3">{onTrack.map((r) => <Card key={r.project.id} r={r} />)}</div>
          </div>
        </div>
      )}
    </main>
  );
}
