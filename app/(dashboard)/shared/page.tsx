import { createAdminClient, createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SharedListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();

  // Membership rows the current user can see (RLS allows their own email)
  const { data: memberships } = await supabase
    .from("project_members").select("project_id")
    .ilike("member_email", email ?? "___none___");

  const projectIds = (memberships ?? []).map((m) => m.project_id);
  let projects: { id: string; name: string; status: string }[] = [];
  if (projectIds.length) {
    // Read project summaries via admin (cross-owner) — membership already verified above
    const admin = await createAdminClient();
    const { data } = await admin
      .from("projects").select("id, name, status").in("id", projectIds);
    projects = data ?? [];
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Shared with you</h1>
      <p className="text-sm text-neutral-500 mb-8">Read-only projects others have shared with you.</p>

      {projects.length === 0 ? (
        <p className="text-sm text-neutral-600 text-center py-12">Nothing shared with you yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/shared/${p.id}`}
              className="block border border-white/10 rounded-xl p-5 hover:border-white/25 transition-all">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-neutral-500 mt-1">{p.status} · read-only</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
