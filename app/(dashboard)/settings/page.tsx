import { VercelConnectForm } from "@/components/vercel-connect-form";
import { SupabaseConnectForm } from "@/components/supabase-connect-form";
import { ResendConnectForm } from "@/components/resend-connect-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const LABELS: Record<string, string> = {
  github: "GitHub",
  vercel: "Vercel",
  supabase: "Supabase",
  resend: "Resend",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data: connections }] = await Promise.all([
    supabase.from("profiles").select("plan, github_username").eq("id", user.id).single(),
    supabase.from("oauth_connections").select("provider").eq("user_id", user.id),
  ]);

  const has = (p: string) => connections?.some((c) => c.provider === p) ?? false;
  const hasGitHub = has("github");
  const hasVercel = has("vercel");
  const hasSupabase = has("supabase");
  const hasResend = has("resend");
  const plan = profile?.plan ?? "free";

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Header + close */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Connect a service once — every new project reuses it automatically.
          </p>
        </div>
        <Link href="/dashboard" className="text-neutral-500 hover:text-white transition-colors text-xl leading-none shrink-0" aria-label="Close">✕</Link>
      </div>

      {params.connected && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-lg">
          ✓ {LABELS[params.connected] ?? params.connected} connected.
        </div>
      )}
      {params.error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
          Connection failed. Please try again.
        </div>
      )}

      {/* Account */}
      <section className="border border-white/10 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold">Account</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Signed in as</span>
          <span className="text-neutral-200">{profile?.github_username ?? user.email}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">Plan</span>
          <span className="flex items-center gap-2">
            <span className="bg-white/10 text-white/70 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide">{plan}</span>
            <Link href="/upgrade" className="text-violet-300 hover:underline text-xs">Manage billing →</Link>
          </span>
        </div>
      </section>

      {/* Integrations */}
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold">Integrations</h2>
          <p className="text-sm text-neutral-500 mt-1">
            These power what your provisioned projects can do. GitHub is required; the rest are optional.
          </p>
        </div>

        {/* GitHub */}
        <IntegrationCard icon="" name="GitHub" connected={hasGitHub}
          desc="Each project gets its own private repo, created automatically.">
          {hasGitHub
            ? <ConnectedNote text="Connected — new projects get a repo automatically." />
            : (
              <a href="/api/github/connect"
                className="inline-flex items-center justify-center gap-2 bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors">
                Connect GitHub →
              </a>
            )}
        </IntegrationCard>

        {/* Vercel */}
        <IntegrationCard icon="▲" name="Vercel" connected={hasVercel}
          desc="Deploy live with a public URL + CI/CD.">
          {hasVercel
            ? <ConnectedNote text="Connected — new projects deploy automatically." />
            : <VercelConnectForm redirectTo="/settings" />}
        </IntegrationCard>

        {/* Supabase */}
        <IntegrationCard icon="⚡" name="Supabase" connected={hasSupabase}
          desc="Auth + database + storage, auto-created per project.">
          {hasSupabase
            ? <ConnectedNote text="Connected — new projects get their own database." />
            : <SupabaseConnectForm redirectTo="/settings" />}
          <div className="mt-3 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-200/90 leading-relaxed">
            Each project creates its <b>own</b> Supabase project in your org. Supabase&apos;s free tier
            allows <b>2</b> active projects — to run up to <b>8</b> you&apos;ll need{" "}
            <a href="https://supabase.com/dashboard/org/_/billing" target="_blank" rel="noopener noreferrer"
              className="text-amber-200 underline underline-offset-2">Supabase Pro ($25/mo)</a>.
          </div>
        </IntegrationCard>

        {/* Resend */}
        <IntegrationCard icon="✉" name="Resend" connected={hasResend}
          desc="Transactional email out of the box.">
          {hasResend
            ? <ConnectedNote text="Connected — new projects can send email automatically." />
            : <ResendConnectForm redirectTo="/settings" />}
        </IntegrationCard>
      </section>
    </main>
  );
}

function IntegrationCard({
  icon, name, connected, desc, children,
}: {
  icon: string; name: string; connected: boolean; desc: string; children: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-neutral-400">{icon}</span>}
          <span className="font-medium">{name}</span>
        </div>
        {connected
          ? <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">Connected</span>
          : <span className="text-[10px] text-neutral-500 bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">Not connected</span>}
      </div>
      <p className="text-xs text-neutral-500">{desc}</p>
      {children}
    </div>
  );
}

function ConnectedNote({ text }: { text: string }) {
  return <p className="text-xs text-neutral-400">{text}</p>;
}
