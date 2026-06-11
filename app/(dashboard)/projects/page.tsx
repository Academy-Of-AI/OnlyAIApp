import { GetStartedChecklist } from "@/components/get-started-checklist";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/date";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  deployed:     "chip chip-success",
  provisioning: "chip chip-warn",
  building:     "chip chip-warn",
  pending:      "chip chip-neutral",
  failed:       "chip chip-danger",
};

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: projects }, { data: connections }, { count: planCount }, { count: memoryCount }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user!.id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("oauth_connections").select("provider").eq("user_id", user!.id),
    supabase.from("project_plans").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
    supabase.from("project_memory").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
    supabase.from("profiles").select("plan").eq("id", user!.id).single(),
  ]);

  const hasGitHub = connections?.some((c) => c.provider === "github");
  const hasVercel = connections?.some((c) => c.provider === "vercel");
  const hasSupabase = connections?.some((c) => c.provider === "supabase");
  const canCreate = hasGitHub;
  const hasShipped = projects?.some((p) => p.status === "deployed") ?? false;
  const isPro = profile?.plan === "pro";

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">🧱 Studio</p>
          <h1 className="text-xl font-bold font-display tracking-tight text-on-surface mt-1">Your builds</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Each one is a real app on your own GitHub + hosting. Yours to keep.</p>
        </div>
        <div className="flex items-center gap-2">
          {!!projects?.length && (
            <Link href="/mission-control" className="btn-ghost text-sm px-4 py-2">▦ Mission Control</Link>
          )}
          <Link href="/tracks" className="btn-brand text-sm px-4 py-2">+ New build</Link>
        </div>
      </div>

      {/* Onboarding checklist — only while still working toward the first ship */}
      {!!projects?.length && !hasShipped && (
        <GetStartedChecklist
          hasGitHub={!!hasGitHub} hasVercel={!!hasVercel} hasSupabase={!!hasSupabase}
          hasProject={!!projects?.length}
          hasPlan={(planCount ?? 0) > 0} hasMemory={(memoryCount ?? 0) > 0}
          hasShipped={hasShipped}
          projectId={projects?.[0]?.id ?? null}
          isPro={isPro}
        />
      )}

      {/* Project list */}
      {!projects?.length ? (
        <div className="text-center py-20 text-on-surface-variant space-y-2">
          <p className="text-3xl">🚀</p>
          <p>No builds yet — let’s fix that.</p>
          <Link href="/tracks" className="text-brand hover:underline text-sm">Pick a track &amp; start your first build →</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {projects.map((p) => {
            const done = Array.isArray(p.plan_progress) ? p.plan_progress.length : 0;
            return (
              <div key={p.id} className="panel p-5 space-y-3 hover:border-outline transition-all">
                <Link href={`/projects/${p.id}`} className="block space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold truncate text-on-surface">{p.name}</span>
                    <span className={`shrink-0 ${STATUS_STYLES[p.status] ?? STATUS_STYLES.pending}`}>{p.status}</span>
                  </div>
                  <p className="text-xs text-outline">{p.template_id}</p>
                  <div className="flex gap-3 text-xs">
                    {p.github_repo_url && <span className="text-on-surface-variant">GitHub →</span>}
                    {/* Only once truly deployed — the URL 404s while still building. */}
                    {p.status === "deployed" && p.vercel_preview_url && <span className="text-on-surface-variant">Live URL →</span>}
                    {done > 0 && <span className="text-on-surface-variant">✓ {done} milestone{done === 1 ? "" : "s"}</span>}
                  </div>
                  {p.error && <p className="text-xs text-danger truncate">{p.error}</p>}
                </Link>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-outline">{formatDate(p.created_at)}</p>
                  <DeleteProjectButton projectId={p.id} projectName={p.name} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
