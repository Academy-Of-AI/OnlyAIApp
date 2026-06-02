import { OpsPanel } from "@/components/ops-panel";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
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
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
        <Link href="/mission-control" className="hover:text-white transition-colors">Mission Control</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-white transition-colors">{project.name}</Link>
        <span>/</span>
        <span className="text-neutral-300">Ops</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-1">Ops · {project.name}</h1>
      <p className="text-sm text-neutral-500 mb-8">Environment variables and deploy rollback.</p>

      <OpsPanel projectId={id} initialEnvs={envs} />
    </main>
  );
}
