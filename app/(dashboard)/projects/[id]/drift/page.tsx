import { DriftPanel } from "@/components/drift-panel";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DriftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects").select("id, name").eq("id", id).eq("user_id", user!.id).single();
  if (!project) notFound();

  const { data: plan } = await supabase
    .from("project_plans").select("id")
    .eq("project_id", id).eq("user_id", user!.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
        <Link href="/mission-control" className="hover:text-white transition-colors">Mission Control</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-white transition-colors">{project.name}</Link>
        <span>/</span>
        <span className="text-neutral-300">Course-keeper</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-1">Course-keeper · {project.name}</h1>
      <p className="text-sm text-neutral-500 mb-8">
        Keeps your work tethered to the objective — flags scope creep and rabbit holes before they cost you days.
      </p>

      <DriftPanel projectId={id} hasPlan={!!plan} />
    </main>
  );
}
