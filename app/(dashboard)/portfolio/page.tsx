import { createClient } from "@/lib/supabase/server";
import { normalizePlan } from "@/lib/plan";
import { ArtifactStudio, CopyLinkButton } from "@/components/portfolio-tools";
import Link from "next/link";

export const metadata = { title: "Portfolio — OnlyAIApp" };

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: projects }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("plan, github_username").eq("id", user!.id).single(),
  ]);

  const list = projects ?? [];
  const shipped = list.filter((p) => p.status === "deployed");
  const building = list.filter((p) => p.status !== "deployed");
  const milestones = list.reduce((n, p) => n + (Array.isArray(p.plan_progress) ? p.plan_progress.length : 0), 0);
  const isPro = normalizePlan(profile?.plan) === "pro";
  const name = profile?.github_username || user?.email?.split("@")[0] || "Builder";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <p className="eyebrow">🎖️ Proof</p>
        <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface mt-1.5">Your portfolio</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          The whole point: proof you can show recruiters, clients, and your network. This is your career leverage.
        </p>
      </div>

      {/* Profile header */}
      <div className="panel p-4 sm:p-[18px] flex items-center gap-4 flex-wrap">
        <span className="rounded-xl grid place-items-center text-white text-lg font-bold shrink-0" style={{ background: "linear-gradient(135deg, var(--color-brand), #d946ef)", width: 52, height: 52 }}>{initials}</span>
        <div className="flex-1 min-w-[160px]">
          <p className="font-display font-semibold text-lg text-on-surface">{name}</p>
          <p className="text-sm text-on-surface-variant">AI builder — {shipped.length} app{shipped.length === 1 ? "" : "s"} shipped{building.length ? `, ${building.length} building` : ""}</p>
        </div>
        {profile?.github_username && isPro ? (
          <div className="flex gap-2 flex-wrap">
            <CopyLinkButton username={profile.github_username} />
            <a href={`/u/${profile.github_username}`} target="_blank" rel="noopener noreferrer" className="btn-brand text-sm px-3 py-1.5">View public ↗</a>
          </div>
        ) : (
          <Link href="/upgrade" className="btn-ghost text-sm px-3 py-1.5" title="Public profile is a Pro feature">🔗 Public profile (Pro)</Link>
        )}
      </div>

      {/* Proof stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Apps shipped" value={shipped.length} />
        <Stat label="Building" value={building.length} />
        <Stat label="Milestones" value={milestones} />
        <Stat label="Proof points" value={shipped.length + milestones} />
      </div>

      {/* Shipped pieces */}
      <div>
        <p className="eyebrow">Things you’ve shipped</p>
        {shipped.length === 0 ? (
          <div className="panel p-6 text-center text-on-surface-variant text-sm mt-2 space-y-2">
            <p className="text-2xl">🌱</p>
            <p>No shipped apps yet — your first one lands here as proof.</p>
            <Link href="/tracks" className="text-brand-dim hover:underline">Pick a track →</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 mt-2">
            {shipped.map((p) => (
              <div key={p.id} className="panel p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2"><span className="chip chip-success">Live</span><span className="font-display font-semibold text-on-surface truncate">{p.name}</span></div>
                <div className="text-xs text-on-surface-variant bg-surface-dim border border-outline-variant rounded-lg px-2.5 py-2">
                  Proves: <b className="text-on-surface">you can ship a real, working app end-to-end.</b>
                </div>
                <div className="flex gap-2 mt-auto pt-1">
                  {p.vercel_preview_url && <a href={p.vercel_preview_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs px-3 py-1.5">Live ↗</a>}
                  <Link href={`/projects/${p.id}`} className="btn-ghost text-xs px-3 py-1.5">Open</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Career artifacts (Pro) */}
      <div>
        <p className="eyebrow">Career-ready artifacts</p>
        {isPro ? (
          <div className="mt-2"><ArtifactStudio /></div>
        ) : (
          <div className="panel p-5 mt-2 relative overflow-hidden">
            <div className="blur-[3px] select-none pointer-events-none">
              <ul className="space-y-2.5">
                <ArtifactRow icon="📄" title="Case study" sub="“How I built & shipped a real app” — 1-page PDF" />
                <ArtifactRow icon="💼" title="LinkedIn post" sub="Ready-to-publish announcement of what you shipped" />
                <ArtifactRow icon="📝" title="Résumé line" sub="“Designed & shipped production web apps, solo.”" />
                <ArtifactRow icon="🔗" title="Shareable proof links" sub="Live apps + public profile in one link" />
              </ul>
            </div>
            <div className="absolute inset-0 grid place-items-center bg-surface/40">
              <Link href="/upgrade" className="btn-brand text-sm px-5 py-2.5">✨ Unlock career artifacts (Pro)</Link>
            </div>
          </div>
        )}
        <p className="text-xs text-outline mt-2">💡 This turns “I’m learning AI” into “here’s what I’ve built.” Proof &gt; promises.</p>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value tabnum">{value}</div>
    </div>
  );
}

function ArtifactRow({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-9 h-9 rounded-lg grid place-items-center bg-brand-container text-lg shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-variant truncate">{sub}</p>
      </div>
    </li>
  );
}
