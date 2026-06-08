import { OptInNudge } from "@/components/optin-nudge";
import { ReferralCard } from "@/components/referral-card";
import { createClient } from "@/lib/supabase/server";
import { normalizePlan, hasOptInBonus } from "@/lib/plan";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  deployed:     "chip chip-success",
  provisioning: "chip chip-warn",
  building:     "chip chip-warn",
  pending:      "chip chip-neutral",
  failed:       "chip chip-danger",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: projects }, { data: connections }, { data: profile }, { data: wall }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("oauth_connections").select("provider").eq("user_id", user!.id),
    supabase.from("profiles").select("plan, phone, marketing_consent, github_username").eq("id", user!.id).single(),
    supabase.from("wall_submissions").select("title, tagline, builder_name, demo_url").order("created_at", { ascending: false }).limit(1),
  ]);

  const hasGitHub = connections?.some((c) => c.provider === "github");
  const showOptInNudge = normalizePlan(profile?.plan) === "free" && !hasOptInBonus(profile);

  const list = projects ?? [];
  const shipped = list.filter((p) => p.status === "deployed").length;
  const inProgress = list.filter((p) => p.status !== "deployed").length;
  const milestones = list.reduce((n, p) => n + (Array.isArray(p.plan_progress) ? p.plan_progress.length : 0), 0);
  const activeBuild = list.find((p) => p.status !== "deployed") ?? list[0] ?? null;
  const firstName = (profile?.github_username || user?.email || "there").split(/[@ ]/)[0];
  const highlight = wall?.[0] ?? null;

  function connectedLabel(provider: string) {
    return ({ github: "GitHub", vercel: "Vercel", supabase: "Supabase", resend: "Resend", stripe: "Stripe" } as Record<string, string>)[provider] ?? provider;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Alerts */}
      {params.connected && (
        <div className="panel border-l-2 border-l-success text-success text-sm px-4 py-3">✓ {connectedLabel(params.connected)} connected successfully.</div>
      )}
      {params.error && (
        <div className="panel border-l-2 border-l-danger text-danger text-sm px-4 py-3">Connection failed. Please try again.</div>
      )}

      {/* Header */}
      <div>
        <p className="eyebrow">👋 Today</p>
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-on-surface mt-1.5">
          Hey {firstName} — let’s ship something 🚀
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Build real things. Show them off. Level up your career. <span className="opacity-80">(yes, it’s allowed to be fun.)</span>
        </p>
      </div>

      {/* Connect GitHub (only thing needed to start) */}
      {!hasGitHub && (
        <section className="panel border-brand-border bg-brand-container p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="font-display tracking-tight font-semibold text-lg text-on-surface">Connect GitHub to start</h2>
            <p className="text-sm text-on-surface-variant mt-1">Your builds get a private repo, created automatically. It’s the only thing you need to begin.</p>
          </div>
          <a href="/api/github/connect" className="btn-brand flex items-center justify-center gap-2 text-sm px-4 py-2.5 w-full sm:w-auto"><GHIcon /> Connect GitHub →</a>
          <p className="text-xs text-outline">
            No GitHub account?{" "}
            <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer" className="text-on-surface-variant hover:text-on-surface underline underline-offset-2">Create one free →</a>{" "}
            — it takes a minute, then come back and connect.
          </p>
        </section>
      )}

      {/* Free-tier opt-in nudge → +1 project */}
      {hasGitHub && showOptInNudge && <OptInNudge />}

      {/* Continue building / start first build */}
      {hasGitHub && (
        activeBuild ? (
          <div>
            <p className="eyebrow">▶ Pick up where you left off</p>
            <div className="panel p-5 sm:p-[18px] mt-2 border-l-[3px] border-l-brand">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={STATUS_STYLES[activeBuild.status] ?? STATUS_STYLES.pending}>{activeBuild.status}</span>
                  <span className="font-display font-semibold text-base sm:text-lg truncate text-on-surface">{activeBuild.name}</span>
                </div>
                {Array.isArray(activeBuild.plan_progress) && activeBuild.plan_progress.length > 0 && (
                  <span className="text-xs text-on-surface-variant tabnum">✓ {activeBuild.plan_progress.length} milestone{activeBuild.plan_progress.length === 1 ? "" : "s"} done</span>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 flex-wrap rounded-lg bg-surface-dim border border-outline-variant px-3 py-3">
                <div className="min-w-0">
                  <p className="eyebrow">🎯 Your one next move</p>
                  <p className="text-sm text-on-surface mt-0.5">
                    {activeBuild.status === "deployed" ? "It’s live — add the next feature or polish it." : "Open it and keep building toward your v1."}
                  </p>
                </div>
                <Link href={`/projects/${activeBuild.id}`} className="btn-brand text-sm px-4 py-2 shrink-0">Open build →</Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel p-6 text-center space-y-3">
            <p className="text-3xl">🚀</p>
            <h2 className="font-display font-semibold text-lg text-on-surface">Build your first real app</h2>
            <p className="text-sm text-on-surface-variant max-w-md mx-auto">Pick an outcome — a portfolio project, a side-income tool, killing your busywork — and we’ll spin up a live app to start from.</p>
            <Link href="/tracks" className="btn-brand text-sm px-5 py-2.5 inline-flex">Pick a track →</Link>
          </div>
        )
      )}

      {/* Quick actions */}
      {hasGitHub && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/tracks" className="panel p-4 hover:border-outline transition-all">
            <div className="text-xl">🧭</div>
            <p className="font-display font-semibold text-on-surface mt-2">Start a new build</p>
            <p className="text-xs text-on-surface-variant">Pick a track → ship a real thing</p>
          </Link>
          <Link href="/portfolio" className="panel p-4 hover:border-outline transition-all">
            <div className="text-xl">🎖️</div>
            <p className="font-display font-semibold text-on-surface mt-2">Your proof</p>
            <p className="text-xs text-on-surface-variant">Portfolio you can show anyone</p>
          </Link>
          <Link href="/directory" className="panel p-4 hover:border-outline transition-all">
            <div className="text-xl">✨</div>
            <p className="font-display font-semibold text-on-surface mt-2">See what’s shipped</p>
            <p className="text-xs text-on-surface-variant">Real apps from real builders</p>
          </Link>
        </div>
      )}

      {/* Momentum */}
      {hasGitHub && (
        <div>
          <p className="eyebrow">🔥 Your momentum</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            <Stat label="Apps shipped" value={shipped} foot="live & owned by you" />
            <Stat label="In progress" value={inProgress} foot="builds underway" />
            <Stat label="Milestones" value={milestones} foot="v1 steps done" />
            <Stat label="On showcase" value={shipped} foot="public proof" />
          </div>
        </div>
      )}

      {/* Referral — free marketing loop */}
      {hasGitHub && <ReferralCard code={profile?.github_username || "you"} />}

      {/* Showcase highlight */}
      {highlight && (
        <div>
          <div className="flex items-center justify-between">
            <p className="eyebrow">✨ Fresh from the Showcase</p>
            <Link href="/directory" className="text-xs text-brand-dim hover:underline">See all →</Link>
          </div>
          <div className="panel p-4 mt-2 flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg shrink-0 grid place-items-center text-brand-dim bg-brand-container font-bold text-sm">{(highlight.title || "App").slice(0, 2)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="chip chip-success">Live</span><span className="font-display font-semibold text-on-surface truncate">{highlight.title}</span></div>
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">{highlight.tagline}{highlight.builder_name ? ` · by ${highlight.builder_name}` : ""}</p>
            </div>
            {highlight.demo_url && (
              <a href={highlight.demo_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs px-3 py-1.5 shrink-0">Visit →</a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, foot }: { label: string; value: number; foot: string }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value tabnum">{value}</div>
      <div className="text-[11px] text-on-surface-variant mt-1">{foot}</div>
    </div>
  );
}

function GHIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.58v-2.03c-3.34.72-4.04-1.6-4.04-1.6-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
