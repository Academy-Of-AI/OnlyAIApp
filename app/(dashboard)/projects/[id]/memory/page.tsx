import { MemoryPanel } from "@/components/memory-panel";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MemoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: project }, { data: memory }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", id).eq("user_id", user!.id).single(),
    supabase.from("project_memory").select("id, kind, content, created_at")
      .eq("project_id", id).eq("user_id", user!.id).order("created_at", { ascending: false }),
  ]);
  if (!project) notFound();

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
        <Link href="/mission-control" className="hover:text-white transition-colors">Mission Control</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-white transition-colors">{project.name}</Link>
        <span>/</span>
        <span className="text-neutral-300">Memory</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-1">Memory · {project.name}</h1>
      <p className="text-sm text-neutral-500 mb-8">
        Persistent project context. Decisions, architecture, and gotchas live here and sync into
        <span className="font-mono text-neutral-400"> CLAUDE.md</span>, which Claude Code reads every session.
      </p>

      <MemoryPanel projectId={id} initial={memory ?? []} />
    </main>
  );
}
