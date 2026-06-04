import { ProjectTabs } from "@/components/project-tabs";
import type { Result as PlanPackResult } from "@/components/plan-pack";
import { decrypt } from "@/lib/crypto";
import { getLatestDeploymentStatus, getVercelProjectDomain } from "@/lib/vercel";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", id).eq("user_id", user!.id).single();

  if (!project) notFound();

  // Build credits + whether owner-funded AI builds are enabled (the cost switch)
  const { data: creditRow } = await supabase
    .from("profiles")
    .select("build_credits")
    .eq("id", user!.id)
    .single();
  const buildCredits = (creditRow?.build_credits as number | null) ?? 0;

  // Inferred context (zero-forms) — shown read-only inside the Build loop
  const { data: memoryRows } = await supabase
    .from("project_memory")
    .select("kind, content")
    .eq("project_id", id)
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(6);
  const memory = (memoryRows as Array<{ kind: string; content: string }> | null) ?? [];

  // Live URL: link to the PRODUCTION ALIAS (always the latest prod deploy — the
  // real app), not the per-deployment URL (which can be a frozen old build, e.g.
  // the original scaffold). Gate on a READY deploy so it never 404s on an
  // un-built project; fall back to the stored alias.
  let liveUrl: string | null = null;
  if (project.vercel_project_id) {
    try {
      const { data: vConn } = await supabase
        .from("oauth_connections").select("access_token")
        .eq("user_id", user!.id).eq("provider", "vercel").single();
      if (vConn?.access_token) {
        const token = await decrypt(vConn.access_token as string);
        const latest = await getLatestDeploymentStatus({
          token,
          projectId: project.vercel_project_id as string,
        });
        if (latest.state === "READY") {
          liveUrl = await getVercelProjectDomain({
            token,
            projectId: project.vercel_project_id as string,
            projectName: project.name as string,
          });
        }
      }
    } catch { /* no live link */ }
  }
  if (!liveUrl && project.status === "deployed") {
    liveUrl = (project.vercel_preview_url as string | null) ?? null;
  }

  // Persisted plan pack (if the projects.plan_pack column exists) — lets the
  // Plan Pack survive refresh / tab changes without regenerating.
  const initialPack = (project.plan_pack as PlanPackResult | null) ?? null;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-5 min-w-0">
        <Link href="/dashboard" className="hover:text-white transition-colors shrink-0">Dashboard</Link>
        <span className="shrink-0">/</span>
        <span className="text-neutral-300 truncate">{project.name}</span>
      </div>

      <ProjectTabs project={project} buildCredits={buildCredits} memory={memory} liveUrl={liveUrl} initialPack={initialPack} autoCapture={!!project.auto_capture} />
    </main>
  );
}
