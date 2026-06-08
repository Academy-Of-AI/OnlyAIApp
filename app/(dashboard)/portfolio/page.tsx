import { createClient } from "@/lib/supabase/server";
import { artifactLimit } from "@/lib/plan";
import { ArtifactStudio } from "@/components/portfolio-tools";
import { ProfileCard } from "@/components/profile-card";
import { ShowcaseControls } from "@/components/showcase-controls";
import Link from "next/link";

export const metadata = { title: "Portfolio — OnlyAIApp" };

export default async function PortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: projects }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("plan, github_username, artifacts_used, artifacts_period, avatar_url, display_name, headline, linkedin_url, website_url").eq("id", user!.id).single(),
  ]);

  const list = projects ?? [];
  const shipped = list.filter((p) => p.status === "deployed");
  const building = list.filter((p) => p.status !== "deployed");
  const milestones = list.reduce((n, p) => n + (Array.isArray(p.plan_progress) ? p.plan_progress.length : 0), 0);
  const period = new Date().toISOString().slice(0, 7);
  const aiUsed = profile?.artifacts_period === period ? (profile?.artifacts_used ?? 0) : 0;
  const aiLimit = artifactLimit(profile?.plan);
  const aiRemaining = Number.isFinite(aiLimit) ? Math.max(0, aiLimit - aiUsed) : null;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <p className="eyebrow">🎖️ Proof</p>
        <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface mt-1.5">Your portfolio</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          The whole point: proof you can show recruiters, clients, and your network. This is your career leverage.
        </p>
      </div>

      {/* Profile header — editable identity (photo, name, headline, links) */}
      <ProfileCard
        githubUsername={profile?.github_username ?? null}
        email={user?.email ?? null}
        shipped={shipped.length}
        building={building.length}
        initial={{
          avatar_url: profile?.avatar_url ?? null,
          display_name: profile?.display_name ?? null,
          headline: profile?.headline ?? null,
          linkedin_url: profile?.linkedin_url ?? null,
          website_url: profile?.website_url ?? null,
        }}
      />

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
                {/* Showcase — publish + thumbnail, where your proof lives */}
                <div className="border-t border-outline-variant pt-2.5 mt-0.5">
                  <ShowcaseControls projectId={p.id} published={!!p.showcase_published} image={p.showcase_image ?? null} />
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
        <h2 className="font-display font-semibold text-base text-on-surface flex items-center gap-2">🎖️ Career-ready artifacts</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Auto-drafted from what you built — pick an app, copy, post.</p>
        <div className="panel p-5 mt-3"><ArtifactStudio apps={shipped.map((p) => ({ id: p.id, name: p.name, ...parseBrief(p.build_prompt) }))} remaining={aiRemaining} /></div>
        <p className="text-xs text-on-surface-variant mt-3">💡 This turns “I’m learning AI” into “here’s what I’ve built.” Proof &gt; promises.</p>
      </div>
    </main>
  );
}

/** Pull a one-line summary + problem out of the stored build brief (PRD/plan seed). */
function parseBrief(bp?: string | null): { summary?: string; problem?: string } {
  const text = (bp ?? "").trim();
  if (!text) return {};
  const grab = (re: RegExp) => { const m = text.match(re); return m ? m[1].trim() : ""; };
  // Reject filenames, markdown headings/lists, and too-short fragments — they make ugly artifacts.
  const clean = (s: string) => {
    const v = (s || "").replace(/^#+\s*/, "").trim();
    if (/\.(md|txt|pdf|docx?|json)\b/i.test(v)) return "";        // filename
    if (/^[#>*\-`|]/.test(v)) return "";                          // markdown / list
    if (v.length < 10) return "";                                // too short
    if (/requirements?\s*document|\bPRD\b|specification|\bspec\b|architecture\s*(doc|document)|data\s*model|read\s?me|gantt|sprint\s*plan/i.test(v)) return ""; // doc title
    if (/\b(document|doc|spec|plan|prd|readme)\s*$/i.test(v)) return ""; // ends like a doc title
    return v;
  };
  const problem = clean(grab(/Problem:\s*(.+)/i));
  const fromFields = clean(grab(/(?:one workflow[^:]*:|Core things to track:|What I built:)\s*(.+)/i));
  const firstGoodLine = clean(text.split(/\n/).find((l) => clean(l)) ?? "");
  const summary = fromFields || firstGoodLine;
  return { summary: summary || undefined, problem: problem || undefined };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value tabnum">{value}</div>
    </div>
  );
}

