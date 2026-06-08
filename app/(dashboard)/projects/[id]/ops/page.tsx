import { OpsPanel } from "@/components/ops-panel";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { listVercelEnvVars } from "@/lib/vercel";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** The deepest layer — raw env vars + deploy rollback. Everything else (payments,
    hardening, custom domain, Showcase) now lives in the app's Settings / Portfolio. */
export default async function AdvancedOpsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", id).eq("user_id", user!.id).single();
  if (!project) notFound();

  // Load current env vars (keys only) for display.
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
      <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-6 flex-wrap">
        <Link href={`/projects/${id}`} className="hover:text-on-surface transition-colors">{project.name}</Link>
        <span>/</span>
        <span className="text-on-surface">Advanced</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight font-display text-on-surface mb-1">Advanced · {project.name}</h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Raw environment variables &amp; one-click deploy rollback for this app. Most people never need this —
        payments, hardening &amp; custom domain live in{" "}
        <Link href={`/projects/${id}`} className="text-brand hover:text-brand-dim">the app’s Settings</Link>, and you
        publish to the Showcase from your{" "}
        <Link href="/portfolio" className="text-brand hover:text-brand-dim">Portfolio</Link>.
      </p>

      <OpsPanel projectId={id} initialEnvs={envs} />
    </main>
  );
}
