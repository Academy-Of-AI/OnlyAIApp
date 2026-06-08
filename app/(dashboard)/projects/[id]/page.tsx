import { ProjectTabs } from "@/components/project-tabs";
import { ProjectAddOns } from "@/components/project-addons";
import type { Result as PlanPackResult } from "@/components/plan-pack";
import { decrypt } from "@/lib/crypto";
import { getLatestDeploymentStatus, getVercelProjectDomain, listVercelEnvVars } from "@/lib/vercel";
import { canUseDomains, hardeningOf } from "@/lib/plan";
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

  // Pilot is Pro-only — gate the per-project Pilot view.
  const { data: planRow } = await supabase.from("profiles").select("plan").eq("id", user!.id).single();
  const isPro = planRow?.plan === "pro";

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
  let envKeys: string[] = [];
  if (project.vercel_project_id) {
    try {
      const { data: vConn } = await supabase
        .from("oauth_connections").select("access_token, metadata")
        .eq("user_id", user!.id).eq("provider", "vercel").single();
      if (vConn?.access_token) {
        const token = await decrypt(vConn.access_token as string);
        const teamId = (vConn.metadata as { team_id?: string | null } | null)?.team_id ?? undefined;
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
        // Env-var keys (names only) — powers the per-app add-ons "Added" state + Pilot hardening.
        try {
          const envs = await listVercelEnvVars({ token, projectId: project.vercel_project_id as string, teamId });
          envKeys = envs.map((e) => e.key);
        } catch { /* no env keys */ }
      }
    } catch { /* no live link */ }
  }
  if (!liveUrl && project.status === "deployed") {
    liveUrl = (project.vercel_preview_url as string | null) ?? null;
  }

  const canDomain = canUseDomains(planRow?.plan);
  const hardened = hardeningOf(envKeys);

  // Persisted plan pack (if the projects.plan_pack column exists) — lets the
  // Plan Pack survive refresh / tab changes without regenerating.
  const initialPack = (project.plan_pack as PlanPackResult | null) ?? null;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-5 min-w-0">
        <Link href="/dashboard" className="hover:text-on-surface transition-colors shrink-0">Dashboard</Link>
        <span className="shrink-0">/</span>
        <span className="text-on-surface truncate">{project.name}</span>
      </div>

      <ProjectTabs
        project={project} memory={memory} liveUrl={liveUrl} initialPack={initialPack}
        autoCapture={!!project.auto_capture} isPro={isPro} hardened={hardened}
        addons={<ProjectAddOns projectId={id} isPro={isPro} canDomain={canDomain} envKeys={envKeys} />}
      />
    </main>
  );
}
