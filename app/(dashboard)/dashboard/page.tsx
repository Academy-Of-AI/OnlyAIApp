import { GettingStarted } from "@/components/getting-started";
import { NotificationsBell } from "@/components/notifications-bell";
import { ResendConnectForm } from "@/components/resend-connect-form";
import { SupabaseConnectForm } from "@/components/supabase-connect-form";
import { VercelConnectForm } from "@/components/vercel-connect-form";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { UpdateConnectionButton } from "@/components/update-connection-button";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: projects }, { data: connections }, { count: planCount }, { count: memoryCount }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("oauth_connections")
      .select("provider")
      .eq("user_id", user!.id),
    supabase
      .from("project_plans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("project_memory")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
  ]);

  const hasGitHub   = connections?.some((c) => c.provider === "github");
  const hasVercel   = connections?.some((c) => c.provider === "vercel");
  const hasSupabase = connections?.some((c) => c.provider === "supabase");
  const hasResend   = connections?.some((c) => c.provider === "resend");
  const allRequired = hasGitHub && hasVercel && hasSupabase;

  function connectedLabel(provider: string) {
    if (provider === "github")   return "GitHub";
    if (provider === "vercel")   return "Vercel";
    if (provider === "supabase") return "Supabase";
    if (provider === "resend")   return "Resend";
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
      {(!hasGitHub || !hasVercel || !hasSupabase || !hasResend) && (
        <section className="border border-white/10 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-lg">One-time setup — connect your accounts</h2>
            <p className="text-sm text-neutral-400 mt-1">
              Connect your tools and every project gets GitHub, Vercel, Supabase, and email — all wired up automatically.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* GitHub card */}
            <div
              className={`rounded-xl border p-4 space-y-3 ${
                hasGitHub ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/3"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GHIcon />
                  <span className="font-medium text-sm">GitHub</span>
                </div>
                {hasGitHub && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-400 font-medium">✓ Connected</span>
                    <UpdateConnectionButton provider="github" label="Update" />
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Every project gets its own <strong className="text-neutral-200">private GitHub repository</strong> created
                automatically under your account. Your code is always yours — we just push the starter template in.
              </p>
              {!hasGitHub && (
                <a
                  href="/api/github/connect"
                  className="flex items-center justify-center gap-2 bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors w-full"
                >
                  <GHIcon /> Connect GitHub →
                </a>
              )}
            </div>

            {/* Vercel card */}
            <div
              className={`rounded-xl border p-4 space-y-3 ${
                hasVercel ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/3"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">▲</span>
                  <span className="font-medium text-sm">Vercel</span>
                </div>
                {hasVercel && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-400 font-medium">✓ Connected</span>
                    <UpdateConnectionButton provider="vercel" label="Update" />
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Your project is deployed live to <strong className="text-neutral-200">Vercel&apos;s global network</strong> the
                moment you click provision. You get a real public URL, CI/CD, and instant previews — for free on Vercel&apos;s Hobby plan.
              </p>
              {!hasVercel && <VercelConnectForm />}
            </div>

            {/* Supabase card */}
            <div
              className={`rounded-xl border p-4 space-y-3 ${
                hasSupabase ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/3"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⚡</span>
                  <span className="font-medium text-sm">Supabase</span>
                </div>
                {hasSupabase && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-400 font-medium">✓ Connected</span>
                    <UpdateConnectionButton provider="supabase" label="Update" />
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Every project gets its own <strong className="text-neutral-200">Supabase database</strong> — authentication,
                tables, and storage — created automatically. No manual setup. No copy-pasting connection strings.
              </p>
              {!hasSupabase && <SupabaseConnectForm />}
            </div>

            {/* Resend card — optional */}
            <div className={`rounded-xl border p-4 space-y-3 ${
              hasResend ? "border-green-500/30 bg-green-500/5" : "border-white/10 bg-white/[0.03]"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">✉</span>
                  <span className="font-medium text-sm">Resend</span>
                  {!hasResend && (
                    <span className="text-xs text-neutral-600 border border-white/10 px-1.5 py-0.5 rounded-full">optional</span>
                  )}
                </div>
                {hasResend && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-400 font-medium">✓ Connected</span>
                    <UpdateConnectionButton provider="resend" label="Update" />
                  </div>
                )}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Every project gets <strong className="text-neutral-200">transactional email</strong> working
                out of the box — password resets, welcome emails, notifications. Uses your own Resend account so
                your sender reputation stays yours.
              </p>
              {!hasResend && <ResendConnectForm />}
            </div>
          </div>

          {allRequired && hasResend && (
            <p className="text-xs text-green-400 text-center">
              ✓ All accounts connected — you&apos;re ready to provision projects!
            </p>
          )}
          {allRequired && !hasResend && (
            <p className="text-xs text-neutral-500 text-center">
              ✓ Required connections done — connect Resend above to enable email in your projects.
            </p>
          )}
        </section>
      )}

      {/* Control-plane onboarding checklist */}
      {!!projects?.length && (
        <GettingStarted
          accountsConnected={!!allRequired}
          hasProject={!!projects?.length}
          hasPlan={(planCount ?? 0) > 0}
          hasMemory={(memoryCount ?? 0) > 0}
          firstProjectId={projects?.[0]?.id ?? null}
        />
      )}

      {/* Projects header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Your projects</h1>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          {!!projects?.length && (
            <Link
              href="/mission-control"
              className="border border-white/10 hover:border-white/25 text-sm text-neutral-300 hover:text-white px-4 py-2 rounded-lg transition-colors"
            >
              ▦ Mission Control
            </Link>
          )}
          {allRequired && (
            <Link
              href="/new-project"
              className="bg-green-500 hover:bg-green-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              + New project
            </Link>
          )}
        </div>
      </div>

      {/* Project list */}
      {!projects?.length ? (
        <div className="text-center py-20 text-neutral-500 space-y-2">
          <p className="text-3xl">🚀</p>
          <p>No projects yet.</p>
          {allRequired && (
            <Link href="/new-project" className="text-green-400 hover:underline text-sm">
              Provision your first project →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block border border-white/10 rounded-xl p-5 space-y-3 hover:border-white/25 hover:bg-white/[0.02] transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold truncate">{p.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    STATUS_STYLES[p.status] ?? STATUS_STYLES.pending
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-neutral-500">{p.template_id}</p>
              <div className="flex gap-3 text-xs">
                {p.github_repo_url && (
                  <span className="text-neutral-400">GitHub →</span>
                )}
                {p.vercel_preview_url && (
                  <span className="text-green-400">Live URL →</span>
                )}
              </div>
              {p.error && <p className="text-xs text-red-400 truncate">{p.error}</p>}
              <p className="text-xs text-neutral-600">
                {new Date(p.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function GHIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.1.82-.26.82-.58v-2.03c-3.34.72-4.04-1.6-4.04-1.6-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.13 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
