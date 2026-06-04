import { createAdminClient, createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Read-only shared project view. Access is gated by project_members membership. */
export default async function SharedProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) notFound();

  // Verify membership (RLS lets the user see their own invite rows)
  const { data: membership } = await supabase
    .from("project_members").select("id")
    .eq("project_id", id).ilike("member_email", email).maybeSingle();
  if (!membership) notFound();

  // Read the project summary via admin (cross-owner), membership confirmed
  const admin = await createAdminClient();
  const { data: project } = await admin
    .from("projects").select("id, name, status, vercel_preview_url, last_digest").eq("id", id).single();
  if (!project) notFound();

  const { data: plan } = await admin
    .from("project_plans").select("id, objective")
    .eq("project_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  let milestones: { title: string; status: string }[] = [];
  if (plan) {
    const { data: ms } = await admin.from("plan_milestones")
      .select("title, status").eq("plan_id", plan.id).order("position");
    milestones = ms ?? [];
  }
  const { data: memory } = await admin
    .from("project_memory").select("kind, content")
    .eq("project_id", id).order("created_at", { ascending: false }).limit(10);

  const drift = project.last_digest as { onTrack?: boolean; note?: string } | null;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-center gap-2 text-sm text-outline mb-6">
        <Link href="/shared" className="hover:text-on-surface transition-colors">Shared</Link>
        <span>/</span><span className="text-on-surface-variant">{project.name}</span>
        <span className="ml-2 chip chip-neutral">read-only</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-1 font-display text-on-surface">{project.name}</h1>
      <p className="text-sm text-outline mb-6">Status: {project.status}</p>

      {drift && drift.onTrack === false && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-3 text-sm text-warn mb-6">
          ⟲ Drifting{drift.note ? `: ${drift.note}` : ""}
        </div>
      )}

      {plan?.objective && (
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-wide text-outline mb-2">Objective</h2>
          <p className="text-sm text-on-surface">{plan.objective}</p>
        </section>
      )}

      {milestones.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-wide text-outline mb-2">Plan</h2>
          <ul className="space-y-1">
            {milestones.map((m, i) => (
              <li key={i} className="text-sm">
                <span className={m.status === "done" ? "text-success" : m.status === "in_progress" ? "text-warn" : "text-outline"}>
                  {m.status === "done" ? "●" : m.status === "in_progress" ? "◐" : "○"}
                </span>{" "}
                <span className={m.status === "done" ? "line-through text-outline" : "text-on-surface"}>{m.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {memory && memory.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wide text-outline mb-2">Recent context</h2>
          <ul className="space-y-1.5">
            {memory.map((e, i) => (
              <li key={i} className="text-sm text-on-surface-variant">
                <span className="text-[10px] text-outline mr-2">{e.kind}</span>{e.content}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
