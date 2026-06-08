import { OpsPanel } from "@/components/ops-panel";
import { DomainForm } from "@/components/domain-form";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { normalizePlan } from "@/lib/plan";
import { listVercelEnvVars } from "@/lib/vercel";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OpsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", id).eq("user_id", user!.id).single();
  if (!project) notFound();

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user!.id).single();
  const isPro = normalizePlan(profile?.plan) === "pro";

  // Load current env vars (keys only) for display
  let envs: { key: string; target: string[]; type: string }[] = [];
  if (project.vercel_project_id) {
    const { data: conn } = await supabase
      .from("oauth_connections").select("access_token, metadata")
      .eq("user_id", user!.id).eq("provider", "vercel").single();
    if (conn) {
      try {
        const token = await decrypt(conn.access_token as string);
        const meta = conn.metadata as { team_id?: string | null } | null;
        envs = await listVercelEnvVars({
          token, projectId: project.vercel_project_id as string, teamId: meta?.team_id ?? undefined,
        });
      } catch { /* show empty */ }
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-6">
        <Link href="/mission-control" className="hover:text-on-surface transition-colors">Mission Control</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-on-surface transition-colors">{project.name}</Link>
        <span>/</span>
        <span className="text-on-surface">Ops</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight font-display text-on-surface mb-1">Ops · {project.name}</h1>
      <p className="text-sm text-on-surface-variant mb-8">Environment variables and deploy rollback.</p>

      <OpsPanel projectId={id} initialEnvs={envs} />

      {/* Custom domain (Pro) */}
      <section className="mt-10 space-y-3">
        <h2 className="font-semibold text-on-surface flex items-center gap-2">Custom domain <span className="chip chip-brand">Pro</span></h2>
        <p className="text-sm text-on-surface-variant">Point your own domain at this app (e.g. app.yoursite.com).</p>
        {isPro
          ? <DomainForm projectId={id} />
          : <Link href="/upgrade" className="btn-ghost inline-flex text-sm px-4 py-2">✨ Pro feature — upgrade</Link>}
      </section>
    </main>
  );
}
