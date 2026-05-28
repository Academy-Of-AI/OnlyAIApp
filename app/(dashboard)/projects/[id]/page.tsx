import { AutoCaptureToggle } from "@/components/auto-capture-toggle";
import { ProjectTabs } from "@/components/project-tabs";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

const STATUS_STYLES: Record<string, string> = {
  deployed:     "bg-green-500/20 text-green-400",
  provisioning: "bg-yellow-500/20 text-yellow-400",
  building:     "bg-blue-500/20 text-blue-400",
  pending:      "bg-neutral-500/20 text-neutral-400",
  failed:       "bg-red-500/20 text-red-400",
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: project }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).eq("user_id", user!.id).single(),
    supabase.from("profiles").select("build_credits").eq("id", user!.id).single(),
  ]);

  if (!project) notFound();

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
        <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-neutral-300">{project.name}</span>
      </div>

      {/* Project header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[project.status] ?? STATUS_STYLES.pending}`}>
              {project.status}
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            Created {new Date(project.created_at).toLocaleDateString()}
          </p>
          {project.error && (
            <p className="text-xs text-red-400 mt-1 truncate max-w-lg">{project.error}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/projects/${project.id}/plan`}
            className="border border-white/10 hover:border-white/20 text-sm text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            ◇ Plan
          </Link>
          <Link
            href={`/projects/${project.id}/drift`}
            className="border border-white/10 hover:border-white/20 text-sm text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            ⟲ Course-keeper
          </Link>
          <Link
            href={`/projects/${project.id}/activity`}
            className="border border-white/10 hover:border-white/20 text-sm text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            ☰ Activity
          </Link>
          <Link
            href={`/projects/${project.id}/memory`}
            className="border border-white/10 hover:border-white/20 text-sm text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            ◆ Memory
          </Link>
          <Link
            href={`/projects/${project.id}/ops`}
            className="border border-white/10 hover:border-white/20 text-sm text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            ⚙ Ops
          </Link>
          {project.github_repo_url && (
            <a
              href={project.github_repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/10 hover:border-white/20 text-sm text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              GitHub →
            </a>
          )}
          {project.vercel_preview_url && (
            <a
              href={project.vercel_preview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-400 text-black text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              ↗ Live app
            </a>
          )}
        </div>
      </div>

      {/* Auto-capture toggle */}
      <div className="mb-6">
        <AutoCaptureToggle projectId={project.id} enabled={!!project.auto_capture} />
      </div>

      {/* Tabs */}
      <ProjectTabs project={project} buildCredits={profile?.build_credits ?? 0} />
    </main>
  );
}
