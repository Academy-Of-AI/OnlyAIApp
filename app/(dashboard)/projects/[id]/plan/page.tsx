import { PlanPanel } from "@/components/plan-panel";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects").select("id, name").eq("id", id).eq("user_id", user!.id).single();
  if (!project) notFound();

  // Latest plan + its milestones
  const { data: plan } = await supabase
    .from("project_plans").select("id, objective")
    .eq("project_id", id).eq("user_id", user!.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  let milestones: { id: string; title: string; detail: string | null; status: string; position: number }[] = [];
  if (plan) {
    const { data: ms } = await supabase
      .from("plan_milestones").select("id, title, detail, status, position")
      .eq("plan_id", plan.id).order("position", { ascending: true });
    milestones = ms ?? [];
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-6">
        <Link href="/mission-control" className="hover:text-on-surface transition-colors">Mission Control</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-on-surface transition-colors">{project.name}</Link>
        <span>/</span>
        <span className="text-on-surface">Plan</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight font-display text-on-surface mb-1">Plan of record · {project.name}</h1>
      <p className="text-sm text-on-surface-variant mb-8">
        Your objective broken into milestones. This is the North Star the drift detector measures against.
      </p>

      <PlanPanel
        projectId={id}
        hasPlan={!!plan}
        objective={plan?.objective ?? null}
        milestones={milestones}
      />
    </main>
  );
}
