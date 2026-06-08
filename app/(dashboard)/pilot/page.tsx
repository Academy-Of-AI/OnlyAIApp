import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { getDeploymentErrorLine, getLatestDeploymentStatus, listVercelEnvVars } from "@/lib/vercel";
import { hardeningOf } from "@/lib/plan";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

  const [{ data: projects }, { data: vercelConn }, { count: memoryCount }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("oauth_connections").select("access_token, metadata")
      .eq("user_id", user!.id).eq("provider", "vercel").single(),
    supabase.from("project_memory").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
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
  // Per-app hardening — which apps have payments / monitoring add-ons wired up.
  const hardenedFlags = await Promise.all(
    (projects ?? []).map(async (p) => {
      if (!vercelToken || !p.vercel_project_id) return false;
      try {
        const e = await listVercelEnvVars({ token: vercelToken, projectId: p.vercel_project_id as string, teamId: vercelTeamId });
        return hardeningOf(e.map((x) => x.key)).hardened;
      } catch { return false; }
    }),
  );
  const hardenedCount = hardenedFlags.filter(Boolean).length;

  type Proj = {
    id: string; name: string;
    vercel_project_id: string | null; vercel_preview_url: string | null;
    last_digest: { onTrack?: boolean; note?: string } | null;
    plan_pack: { plan?: { now?: string[] } } | null;
    plan_progress: string[] | null;
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
  const building = rows.filter((r) => ["BUILDING", "QUEUED", "INITIALIZING"].includes(r.status?.state ?? "")).length;
  const live = rows.filter((r) => r.status?.state === "READY" || (!!r.project.vercel_preview_url && r.status?.state !== "ERROR")).length;

  // Portfolio v1 progress (aggregate Now-tasks shipped across all projects).
  let v1Done = 0, v1Total = 0;
  for (const r of rows) {
    const now = r.project.plan_pack?.plan?.now ?? [];
    const doneSet = new Set(r.project.plan_progress ?? []);
    v1Total += now.length;
    v1Done += now.filter((i) => doneSet.has(i)).length;
  }
  const v1Pct = v1Total ? Math.round((v1Done / v1Total) * 100) : 0;
  const onTrackPct = rows.length ? Math.round((onTrack.length / rows.length) * 100) : 100;

  function Card({ r }: { r: Row }) {
    const p = r.project;
    const state = r.status?.state ?? "unknown";
    const d = p.last_digest as { onTrack?: boolean; note?: string } | null;
    const isBroken = state === "ERROR";
    const isBuilding = ["BUILDING", "QUEUED", "INITIALIZING"].includes(state);
    const isDrift = d?.onTrack === false;
    const verdict = isBroken
      ? { icon: "🔴", label: "Broken", cls: "text-danger" }
      : isDrift
        ? { icon: "⚠️", label: "Drifting", cls: "text-warn" }
        : isBuilding
          ? { icon: "🛠️", label: "Building", cls: "text-warn" }
          : { icon: "✅", label: "On track", cls: "text-success" };
    const now = p.plan_pack?.plan?.now ?? [];
    const doneSet = new Set(p.plan_progress ?? []);
    const doneCount = now.filter((i) => doneSet.has(i)).length;
    const nextStep = now.find((i) => !doneSet.has(i));
    const reason = isBroken
      ? (r.errorLine ?? "Deploy failed — open the build log.")
      : isDrift ? (d?.note ?? "Recent work is drifting from the plan.") : null;
    return (
      <Link href={`/projects/${p.id}`} className="block panel p-4 hover:bg-surface-high transition-all space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold ${verdict.cls}`}>{verdict.icon} {verdict.label}</span>
          {r.status?.createdAt && <span className="text-[11px] text-outline shrink-0">{timeAgo(r.status.createdAt)}</span>}
        </div>
        <p className="font-display font-semibold text-on-surface truncate">{p.name}</p>
        {reason && <p className="text-xs text-on-surface-variant">{reason}</p>}
        {now.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-1">
              <span>v1 progress</span><span className="tabnum">{doneCount}/{now.length}{doneCount === now.length ? " · ready" : ""}</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-high overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.round((doneCount / now.length) * 100)}%`, background: "var(--color-success)" }} />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-0.5 text-xs">
          {r.status?.commitMessage && <span className="text-on-surface-variant truncate"><span className="text-outline">changed: </span>{r.status.commitMessage}</span>}
          {nextStep && <span className="text-on-surface truncate"><span className="text-brand-dim">next: </span>{nextStep}</span>}
        </div>
      </Link>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Mission Control</p>
          <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface">Pilot — every build, on course &amp; hardened</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Your whole portfolio at a glance — health, progress vs plan, drift, and how production-ready (hardened) each app is.
          </p>
        </div>
        <Link href="/new-project" className="btn-brand text-sm px-4 py-2">＋ New project</Link>
      </div>

      <div className="panel p-4 text-sm text-on-surface-variant">
        🛫 <b className="text-on-surface">Pilot watches every live app</b> for breakage and <b className="text-on-surface">drift from your plan</b>.
        Keep building (commit &amp; push) and it auto-flags <b className="text-on-surface">what changed, what’s off-plan, and what’s next</b> — so nothing slips between sessions.
      </div>

      {/* macro KPIs — the portfolio at a glance */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="tile">
          <p className="tile-label">Apps</p>
          <p className="tile-value text-on-surface">{rows.length}</p>
          <p className="text-[11px] text-outline mt-0.5">projects</p>
        </div>
        <div className="tile">
          <p className="tile-label flex items-center gap-1.5"><span className="dot bg-success" />Live</p>
          <p className="tile-value text-on-surface">{live}</p>
          <p className="text-[11px] text-outline mt-0.5">deployed{building ? ` · ${building} building` : ""}</p>
        </div>
        <div className="tile">
          <p className="tile-label">On track</p>
          <p className="tile-value text-on-surface">{onTrackPct}<span className="text-base font-semibold">%</span></p>
          <p className="text-[11px] text-outline mt-0.5 tabnum">{onTrack.length}/{rows.length} projects</p>
        </div>
        <div className="tile">
          <p className="tile-label">v1 shipped</p>
          <p className="tile-value" style={{ color: "var(--color-brand-dim)" }}>{v1Pct}<span className="text-base font-semibold">%</span></p>
          <p className="text-[11px] text-outline mt-0.5 tabnum">{v1Done}/{v1Total} features</p>
        </div>
        <div className="tile">
          <p className="tile-label flex items-center gap-1.5">🛡️ Hardened</p>
          <p className="tile-value" style={{ color: "var(--color-brand-dim)" }}>{hardenedCount}<span className="text-base font-semibold">/{rows.length}</span></p>
          <p className="text-[11px] text-outline mt-0.5">payments / monitoring</p>
        </div>
        <div className="tile">
          <p className="tile-label">Changes captured</p>
          <p className="tile-value text-on-surface tabnum">{memoryCount ?? 0}</p>
          <p className="text-[11px] text-outline mt-0.5">auto-logged for the AI</p>
        </div>
        <div className="tile">
          <p className="tile-label flex items-center gap-1.5"><span className={`dot ${needsAttention.length ? "bg-danger" : "bg-success"}`} />Needs you</p>
          <p className="tile-value" style={{ color: needsAttention.length ? "var(--color-danger)" : "var(--color-on-surface)" }}>{needsAttention.length}</p>
          <p className="text-[11px] text-outline mt-0.5">{needsAttention.length ? "to act on" : "all clear"}</p>
        </div>
      </div>
      {!vercelToken && <p className="text-xs text-outline">Connect Vercel for live deploy status.</p>}

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

/** Free-tier tease for Pilot (a Pro feature) — show a blurred board behind an upgrade card. */
function PilotLocked() {
  const tiles = [
    { label: "OSes", val: "8", dot: "" },
    { label: "On track", val: "6", dot: "bg-success" },
    { label: "Building", val: "1", dot: "bg-warn-dim" },
    { label: "Broken", val: "1", dot: "bg-danger" },
  ];
  const sample = [
    { name: "deal-os", chip: "chip chip-success", state: "Live", dot: "bg-success", note: "Auto-captured: proposal engine + send tracking. On track." },
    { name: "client-portal", chip: "chip chip-warn", state: "Building", dot: "bg-warn-dim", note: "Deploy building — added billing page." },
    { name: "ops-os", chip: "chip chip-warn", state: "Drifting", dot: "bg-warn", note: "⟲ Drift: settings page is creeping past the plan." },
    { name: "crm-os", chip: "chip chip-danger", state: "Broken", dot: "bg-danger", note: "⚠ Build failed — type error in /lib." },
  ];
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-5">
        <p className="eyebrow">Mission Control</p>
        <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface">Pilot — every build, on course &amp; hardened</h1>
        <p className="text-sm text-on-surface-variant mt-1">Live health, drift &amp; hardening across all your projects.</p>
      </div>

      <div className="relative">
        {/* Blurred teaser board */}
        <div className="blur-[3px] select-none pointer-events-none space-y-4" aria-hidden>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="tile">
                <p className="tile-label flex items-center gap-1.5">{t.dot ? <span className={`dot ${t.dot}`} /> : null}{t.label}</p>
                <p className="tile-value text-on-surface">{t.val}</p>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {sample.map((s) => (
              <div key={s.name} className="panel p-4">
                <p className="font-semibold text-on-surface flex items-center gap-2"><span className={`dot ${s.dot}`} />{s.name}<span className={s.chip}>{s.state}</span></p>
                <p className="text-xs text-on-surface-variant mt-1">{s.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade overlay */}
        <div className="absolute inset-0 grid place-items-center px-4">
          <div className="panel p-6 sm:p-7 text-center space-y-3 max-w-sm" style={{ boxShadow: "0 10px 36px rgba(16,24,40,.16)" }}>
            <p className="text-3xl">🛫</p>
            <p className="eyebrow">Pro feature</p>
            <h2 className="font-display tracking-tight text-xl font-bold text-on-surface">Unlock Pilot</h2>
            <p className="text-sm text-on-surface-variant">
              Live deploy health &amp; drift across every project, auto-capture of what changed, and
              launch-readiness checks — so nothing slips between sessions.
            </p>
            <Link href="/upgrade" className="btn-brand inline-block text-sm px-5 py-2.5">✨ Upgrade to Pro</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
