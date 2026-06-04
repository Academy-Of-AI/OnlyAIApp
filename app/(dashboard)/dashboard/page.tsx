import { GettingStarted } from "@/components/getting-started";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  deployed:     "chip chip-success",
  provisioning: "chip chip-warn",
  building:     "chip chip-warn",
  pending:      "chip chip-neutral",
  failed:       "chip chip-danger",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: projects }, { data: connections }, { count: planCount }, { count: memoryCount }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("oauth_connections")
      .select("provider")
      .eq("user_id", user!.id),
    supabase
      .from("project_plans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("project_memory")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
  ]);

  const hasGitHub   = connections?.some((c) => c.provider === "github");
  // Onramp: GitHub alone is enough to create a project. Vercel/Supabase come later.
  const canCreate = hasGitHub;
  // Hide the "first app" onboarding once they've shipped — beginner framing
  // shouldn't follow an experienced builder around.
  const hasShipped = projects?.some((p) => p.status === "deployed") ?? false;

  function connectedLabel(provider: string) {
    if (provider === "github")   return "GitHub";
    if (provider === "vercel")   return "Vercel";
    if (provider === "supabase") return "Supabase";
    if (provider === "resend")   return "Resend";
    if (provider === "stripe")   return "Stripe";
    return provider;
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 sm:space-y-10">
      {/* Alerts */}
      {params.connected && (
        <div className="panel border-l-2 border-l-success text-success text-sm px-4 py-3">
          ✓ {connectedLabel(params.connected)} connected successfully.
        </div>
      )}
      {params.error && (
        <div className="panel border-l-2 border-l-danger text-danger text-sm px-4 py-3">
          Connection failed. Please try again.
        </div>
      )}

      {/* Required: connect GitHub (the only thing needed to start) */}
      {!hasGitHub && (
        <section className="panel border-brand-border bg-brand-container p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="font-display tracking-tight font-semibold text-lg text-on-surface">Connect GitHub to start</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Your projects get a private repo, created automatically. It&apos;s the only thing you need to begin.
            </p>
          </div>
          <a href="/api/github/connect"
            className="btn-brand flex items-center justify-center gap-2 text-sm px-4 py-2.5 w-full sm:w-auto">
            <GHIcon /> Connect GitHub →
          </a>
          <p className="text-xs text-outline">
            No GitHub account?{" "}
            <a href="https://github.com/signup" target="_blank" rel="noopener noreferrer"
              className="text-on-surface-variant hover:text-on-surface underline underline-offset-2">
              Create one free →
            </a>{" "}
            — it takes a minute, then come back and connect.
          </p>
        </section>
      )}

      {/* Optional integrations live on the Settings page (⚙ in the top nav)
          and inside each project's own Settings tab. */}

      {/* Onboarding checklist — only while still working toward the first ship */}
      {!!projects?.length && !hasShipped && (
        <GettingStarted
          accountsConnected={!!canCreate}
          hasProject={!!projects?.length}
          hasPlan={(planCount ?? 0) > 0}
          hasMemory={(memoryCount ?? 0) > 0}
          firstProjectId={projects?.[0]?.id ?? null}
        />
      )}

      {/* Projects header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="text-xl font-bold font-display tracking-tight text-on-surface">Your projects</h1>
        </div>
        <div className="flex items-center gap-2">
          {!!projects?.length && (
            <Link
              href="/mission-control"
              className="btn-ghost text-sm px-4 py-2"
            >
              ▦ Mission Control
            </Link>
          )}
          {canCreate && (
            <Link
              href="/new-project"
              className="btn-brand text-sm px-4 py-2"
            >
              + New project
            </Link>
          )}
        </div>
      </div>

      {/* Project list */}
      {!projects?.length ? (
        <div className="text-center py-20 text-on-surface-variant space-y-2">
          <p className="text-3xl">🚀</p>
          <p>No projects yet.</p>
          {canCreate && (
            <Link href="/new-project" className="text-brand hover:underline text-sm">
              Create your first project →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="panel p-5 space-y-3 hover:border-outline transition-all"
            >
              <Link href={`/projects/${p.id}`} className="block space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold truncate text-on-surface">{p.name}</span>
                  <span
                    className={`shrink-0 ${
                      STATUS_STYLES[p.status] ?? STATUS_STYLES.pending
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-outline">{p.template_id}</p>
                <div className="flex gap-3 text-xs">
                  {p.github_repo_url && (
                    <span className="text-on-surface-variant">GitHub →</span>
                  )}
                  {p.vercel_preview_url && (
                    <span className="text-on-surface-variant">Live URL →</span>
                  )}
                </div>
                {p.error && <p className="text-xs text-danger truncate">{p.error}</p>}
              </Link>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-outline">{new Date(p.created_at).toLocaleDateString()}</p>
                <DeleteProjectButton projectId={p.id} projectName={p.name} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function GHIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.58v-2.03c-3.34.72-4.04-1.6-4.04-1.6-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
