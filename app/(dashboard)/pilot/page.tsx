import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { getDeploymentErrorLine, getLatestDeploymentStatus, type DeploymentState } from "@/lib/vercel";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATE_UI: Record<DeploymentState, { label: string; dot: string; chip: string }> = {
  READY:        { label: "Live",     dot: "bg-success",  chip: "chip chip-success" },
  BUILDING:     { label: "Building", dot: "bg-warn-dim",  chip: "chip chip-warn" },
  INITIALIZING: { label: "Building", dot: "bg-warn-dim",  chip: "chip chip-warn" },
  QUEUED:       { label: "Queued",   dot: "bg-warn-dim",  chip: "chip chip-warn" },
  ERROR:        { label: "Broken",   dot: "bg-danger",    chip: "chip chip-danger" },
  CANCELED:     { label: "Canceled", dot: "bg-outline", chip: "chip chip-neutral" },
  unknown:      { label: "No deploy", dot: "bg-outline", chip: "chip chip-neutral" },
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

  // Pilot is a Pro feature — free users get a locked upgrade screen.
  const { data: planRow } = await supabase.from("profiles").select("plan").eq("id", user!.id).single();
  if (planRow?.plan !== "pro") return <PilotLocked />;

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
        className="block panel p-4 hover:bg-surface-high transition-all">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`dot shrink-0 ${ui.dot}`} />
            <div className="min-w-0">
              <p className="font-semibold text-on-surface truncate flex items-center gap-2">
                {p.name}
                <span className={ui.chip}>{ui.label}</span>
              </p>
              {r.status?.commitMessage && <p className="text-xs text-outline truncate mt-0.5">{r.status.commitMessage}</p>}
            </div>
          </div>
          {r.status?.createdAt && <span className="text-[11px] text-outline shrink-0">{timeAgo(r.status.createdAt)}</span>}
        </div>
        {r.status?.state === "ERROR" && (
          <p className="mt-2 text-xs text-on-surface-variant"><span className="text-danger">⚠</span> {r.errorLine ?? "Deploy failed — open to see the build log."}</p>
        )}
        {d?.onTrack === false && (
          <p className="mt-2 text-xs text-on-surface-variant"><span className="text-warn">⟲</span> Drifting{d.note ? `: ${d.note}` : ""}</p>
        )}
      </Link>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Mission Control</p>
          <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface">Pilot — every OS, on course</h1>
          <p className="text-sm text-on-surface-variant mt-1">Live health + drift across all your projects.</p>
        </div>
        <Link href="/new-project"
          className="btn-brand text-sm px-4 py-2">
          ＋ New project
        </Link>
      </div>

      {/* summary strip */}
      <div className="flex items-stretch gap-3 flex-wrap">
        <div className="tile flex-1 min-w-[120px]">
          <p className="tile-label">OSes</p>
          <p className="tile-value text-on-surface">{rows.length}</p>
        </div>
        <div className="tile flex-1 min-w-[120px]">
          <p className="tile-label flex items-center gap-1.5"><span className="dot bg-success" />On track</p>
          <p className="tile-value text-on-surface">{onTrack.length}</p>
        </div>
        {building > 0 && (
          <div className="tile flex-1 min-w-[120px]">
            <p className="tile-label flex items-center gap-1.5"><span className="dot bg-warn-dim" />Building</p>
            <p className="tile-value text-on-surface">{building}</p>
          </div>
        )}
        <div className="tile flex-1 min-w-[120px]">
          <p className="tile-label flex items-center gap-1.5"><span className="dot bg-danger" />Broken</p>
          <p className="tile-value text-on-surface">{broken}</p>
        </div>
        {!vercelToken && <span className="text-outline self-center ml-auto text-xs">Connect Vercel for live status</span>}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-24 text-on-surface-variant space-y-2 panel"><p className="text-3xl">🛫</p><p>No projects yet.</p></div>
      ) : (
        <div className="space-y-6">
          {needsAttention.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Needs attention</p>
              <div className="grid sm:grid-cols-2 gap-3">{needsAttention.map((r) => <Card key={r.project.id} r={r} />)}</div>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">On track</p>
            <div className="grid sm:grid-cols-2 gap-3">{onTrack.map((r) => <Card key={r.project.id} r={r} />)}</div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Free-tier lock for Pilot (a Pro feature). */
function PilotLocked() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="panel p-8 text-center space-y-5">
        <p className="text-4xl">🛫</p>
        <div className="space-y-1.5">
          <p className="eyebrow">Pro feature</p>
          <h1 className="font-display tracking-tight text-2xl font-bold text-on-surface">Pilot keeps every build on course</h1>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto">
            Live deploy health and drift across all your projects, auto-capture of what changed and why,
            and launch-readiness checks — so the AI always knows your project and nothing slips.
          </p>
        </div>
        <ul className="text-sm text-on-surface-variant space-y-1.5 inline-block text-left">
          <li className="flex gap-2"><span className="text-brand">✓</span> Cross-project status board</li>
          <li className="flex gap-2"><span className="text-brand">✓</span> Auto-capture + drift detection</li>
          <li className="flex gap-2"><span className="text-brand">✓</span> Launch readiness checks</li>
        </ul>
        <div>
          <Link href="/upgrade" className="btn-brand inline-block text-sm px-5 py-2.5">✨ Upgrade to Pro</Link>
        </div>
      </div>
    </main>
  );
}
