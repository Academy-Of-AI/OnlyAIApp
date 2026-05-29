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

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", id).eq("user_id", user!.id).single();

  if (!project) notFound();

  const navItems = [
    { href: `/projects/${project.id}/plan`,     label: "◇ Plan" },
    { href: `/projects/${project.id}/drift`,    label: "⟲ Course-keeper" },
    { href: `/projects/${project.id}/memory`,   label: "◆ Memory" },
    { href: `/projects/${project.id}/activity`, label: "☰ Activity" },
    { href: `/projects/${project.id}/usage`,    label: "$ Usage" },
    { href: `/projects/${project.id}/share`,    label: "⇲ Share" },
    { href: `/projects/${project.id}/ops`,      label: "⚙ Ops" },
  ];

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-5 min-w-0">
        <Link href="/dashboard" className="hover:text-white transition-colors shrink-0">Dashboard</Link>
        <span className="shrink-0">/</span>
        <span className="text-neutral-300 truncate">{project.name}</span>
      </div>

      {/* Project header — stacks on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{project.name}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[project.status] ?? STATUS_STYLES.pending}`}>
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

        {/* Primary actions */}
        <div className="flex gap-2 shrink-0">
          {project.github_repo_url && (
            <a href={project.github_repo_url} target="_blank" rel="noopener noreferrer"
              className="border border-white/10 hover:border-white/20 text-sm text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
              GitHub →
            </a>
          )}
          {project.vercel_preview_url && (
            <a href={project.vercel_preview_url} target="_blank" rel="noopener noreferrer"
              className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
              ↗ Live app
            </a>
          )}
        </div>
      </div>

      {/* Control-plane sub-nav — horizontally scrollable on mobile, no overflow */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {navItems.map((n) => (
          <Link key={n.href} href={n.href}
            className="shrink-0 whitespace-nowrap border border-white/10 hover:border-white/25 text-sm text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors">
            {n.label}
          </Link>
        ))}
      </div>

      {/* Auto-capture toggle */}
      <div className="mb-6">
        <AutoCaptureToggle projectId={project.id} enabled={!!project.auto_capture} />
      </div>

      {/* Tabs */}
      <ProjectTabs project={project} />
    </main>
  );
}
