import { SharePanel } from "@/components/share-panel";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: project }, { data: members }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", id).eq("user_id", user!.id).single(),
    supabase.from("project_members").select("id, member_email, role, created_at")
      .eq("project_id", id).eq("owner_id", user!.id).order("created_at", { ascending: false }),
  ]);
  if (!project) notFound();

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
        <Link href="/mission-control" className="hover:text-white transition-colors">Mission Control</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-white transition-colors">{project.name}</Link>
        <span>/</span>
        <span className="text-neutral-300">Share</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-1">Share · {project.name}</h1>
      <p className="text-sm text-neutral-500 mb-8">Give teammates or stakeholders a read-only view of this project.</p>

      <SharePanel projectId={id} initial={members ?? []} />
    </main>
  );
}
