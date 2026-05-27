import { SupabaseConnectForm } from "@/components/supabase-connect-form";
import { VercelConnectForm } from "@/components/vercel-connect-form";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  deployed:     "bg-green-500/20 text-green-400",
  provisioning: "bg-yellow-500/20 text-yellow-400",
  pending:      "bg-neutral-500/20 text-neutral-400",
  failed:       "bg-red-500/20 text-red-400",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: projects }, { data: connections }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("oauth_connections")
      .select("provider")
      .eq("user_id", user!.id),
  ]);

  const hasVercel   = connections?.some((c) => c.provider === "vercel");
  const hasSupabase = connections?.some((c) => c.provider === "supabase");
  const allConnected = hasVercel && hasSupabase;

  function connectedLabel(provider: string) {
    if (provider === "vercel")   return "Vercel";
    if (provider === "supabase") return "Supabase";
    return provider;
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
      {/* Alerts */}
      {params.connected && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-lg">
          ✓ {connectedLabel(params.connected)} connected successfully.
        </div>
      )}
      {params.error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
          Connection failed. Please try again.
        </div>
      )}

      {/* Connect integrations banner */}
      {(!hasVercel || !hasSupabase) && (
        <section className="border border-white/10 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-lg">One-time setup — connect your accounts</h2>
            <p className="text-sm text-neutral-400 mt-1">
              Two quick connections and you&apos;re ready to provision projects. You only do this once.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Vercel card */}
            <div className={`rounded-xl border p-5 flex flex-col gap-3 ${
              hasVercel ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/[0.03]"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">▲</span>
                  <span className="font-semibold text-sm">Vercel</span>
                </div>
                {hasVercel && <span className="text-xs text-green-400 font-semibold">✓ Connected</span>}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed flex-1">
                Your project is deployed live to{" "}
                <strong className="text-neutral-200">Vercel&apos;s global network</strong> the moment
                you click provision — real public URL, CI/CD, and instant previews included.
              </p>
              {!hasVercel && <VercelConnectForm />}
            </div>

            {/* Supabase card */}
            <div className={`rounded-xl border p-5 flex flex-col gap-3 ${
              hasSupabase ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/[0.03]"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <span className="font-semibold text-sm">Supabase</span>
                </div>
                {hasSupabase && <span className="text-xs text-green-400 font-semibold">✓ Connected</span>}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed flex-1">
                Every project gets its own{" "}
                <strong className="text-neutral-200">Supabase database</strong> — auth, tables, and
                storage — created automatically. No copy-pasting connection strings.
              </p>
              {!hasSupabase && <SupabaseConnectForm />}
            </div>
          </div>

          {allConnected && (
            <p className="text-xs text-green-400 text-center">
              ✓ All set — you&apos;re ready to provision projects!
            </p>
          )}
        </section>
      )}

      {/* Projects header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Your projects</h1>
        {allConnected && (
          <Link
            href="/new-project"
            className="bg-green-500 hover:bg-green-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New project
          </Link>
        )}
      </div>

      {/* Project list */}
      {!projects?.length ? (
        <div className="text-center py-20 text-neutral-500 space-y-2">
          <p className="text-3xl">🚀</p>
          <p>No projects yet.</p>
          {allConnected && (
            <Link href="/new-project" className="text-green-400 hover:underline text-sm">
              Provision your first project →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="border border-white/10 rounded-xl p-5 space-y-3 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold truncate">{p.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  STATUS_STYLES[p.status] ?? STATUS_STYLES.pending
                }`}>
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-neutral-500">{p.template_id}</p>
              <div className="flex gap-3 text-xs">
                {p.github_repo_url && (
                  <a href={p.github_repo_url} target="_blank" rel="noopener noreferrer"
                    className="text-neutral-400 hover:text-white transition-colors">
                    GitHub →
                  </a>
                )}
                {p.vercel_preview_url && (
                  <a href={p.vercel_preview_url} target="_blank" rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300 transition-colors">
                    Live URL →
                  </a>
                )}
              </div>
              {p.error && <p className="text-xs text-red-400 truncate">{p.error}</p>}
              <p className="text-xs text-neutral-600">
                {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
