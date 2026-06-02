import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const ICON: Record<string, string> = {
  memory: "◆", milestone: "✓", drift: "⟲", deploy: "▲", build: "⚙", event: "•",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: project }, { data: activity }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", id).eq("user_id", user!.id).single(),
    supabase.from("project_activity").select("id, type, summary, created_at")
      .eq("project_id", id).eq("user_id", user!.id)
      .order("created_at", { ascending: false }).limit(100),
  ]);
  if (!project) notFound();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
        <Link href="/mission-control" className="hover:text-white transition-colors">Mission Control</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-white transition-colors">{project.name}</Link>
        <span>/</span>
        <span className="text-neutral-300">Activity</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-1">Activity · {project.name}</h1>
      <p className="text-sm text-neutral-500 mb-8">Everything the control plane has captured — auto-logged.</p>

      {!activity?.length ? (
        <p className="text-sm text-neutral-600 text-center py-12">
          No activity yet. Enable auto-capture and push a commit, or run the CLI.
        </p>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />
          {activity.map((a) => (
            <div key={a.id} className="relative pb-5">
              <span className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-neutral-800 border border-white/20 grid place-items-center text-[8px]">
                {ICON[a.type] ?? "•"}
              </span>
              <div className="text-sm text-neutral-200">{a.summary}</div>
              <div className="text-xs text-neutral-600 mt-0.5">{timeAgo(a.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
