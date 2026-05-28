import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UsagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: project }, { data: events }] = await Promise.all([
    supabase.from("projects").select("id, name").eq("id", id).eq("user_id", user!.id).single(),
    supabase.from("usage_events").select("kind, input_tokens, output_tokens, cost_cents, created_at")
      .eq("project_id", id).eq("user_id", user!.id)
      .order("created_at", { ascending: false }).limit(100),
  ]);
  if (!project) notFound();

  const rows = events ?? [];
  const totalCents = rows.reduce((s, r) => s + (r.cost_cents ?? 0), 0);
  const totalTokens = rows.reduce((s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);

  const byKind: Record<string, { cents: number; count: number }> = {};
  for (const r of rows) {
    const k = r.kind ?? "ai";
    byKind[k] = byKind[k] ?? { cents: 0, count: 0 };
    byKind[k].cents += r.cost_cents ?? 0;
    byKind[k].count += 1;
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-6">
        <Link href="/mission-control" className="hover:text-white transition-colors">Mission Control</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-white transition-colors">{project.name}</Link>
        <span>/</span>
        <span className="text-neutral-300">Usage</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-1">Usage · {project.name}</h1>
      <p className="text-sm text-neutral-500 mb-8">Estimated AI spend for this project.</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border border-white/10 rounded-xl p-5">
          <div className="text-xs text-neutral-500">Estimated spend</div>
          <div className="text-3xl font-bold mt-1">${(totalCents / 100).toFixed(2)}</div>
        </div>
        <div className="border border-white/10 rounded-xl p-5">
          <div className="text-xs text-neutral-500">Tokens</div>
          <div className="text-3xl font-bold mt-1">{(totalTokens / 1000).toFixed(0)}k</div>
        </div>
      </div>

      {Object.keys(byKind).length > 0 && (
        <div className="border border-white/10 rounded-xl divide-y divide-white/5 mb-8">
          {Object.entries(byKind).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="capitalize">{k} <span className="text-neutral-600">×{v.count}</span></span>
              <span className="font-mono text-neutral-400">${(v.cents / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 && (
        <p className="text-sm text-neutral-600 text-center py-8">No usage recorded yet.</p>
      )}
    </main>
  );
}
