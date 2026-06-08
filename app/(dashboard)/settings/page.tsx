import { VercelConnectForm } from "@/components/vercel-connect-form";
import { SupabaseConnectForm } from "@/components/supabase-connect-form";
import { ResendConnectForm } from "@/components/resend-connect-form";
import { StripeConnectButton } from "@/components/stripe-connect-button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const LABELS: Record<string, string> = {
  github: "GitHub",
  vercel: "Vercel",
  supabase: "Supabase",
  resend: "Resend",
  stripe: "Stripe",
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
  const hasStripe = has("stripe");
  const plan = profile?.plan ?? "free";
  const isPro = plan === "pro";

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Header + close */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-display text-on-surface">Settings</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Connect a service once — every new project reuses it automatically.
          </p>
        </div>
        <Link href="/dashboard" className="text-outline hover:text-on-surface transition-colors text-xl leading-none shrink-0" aria-label="Close">✕</Link>
      </div>

      {params.connected && (
        <div className="bg-success/10 border border-success/30 text-success text-sm px-4 py-3 rounded-lg">
          ✓ {LABELS[params.connected] ?? params.connected} connected.
        </div>
      )}
      {params.error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-lg">
          Connection failed. Please try again.
        </div>
      )}

      {/* Account */}
      <section className="panel p-5 space-y-3">
        <h2 className="font-semibold text-on-surface">Account</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-on-surface-variant">Signed in as</span>
          <span className="text-on-surface">{profile?.github_username ?? user.email}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-on-surface-variant">Plan</span>
          <span className="flex items-center gap-2">
            <span className="chip chip-neutral">{plan}</span>
            <Link href="/upgrade" className="text-brand hover:underline text-xs">Manage billing →</Link>
          </span>
        </div>
      </section>

      {/* Integrations */}
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-on-surface">Integrations</h2>
          <p className="text-sm text-on-surface-variant mt-1">
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
                className="btn-brand inline-flex items-center justify-center gap-2 text-sm px-4 py-2 transition-colors">
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
        </IntegrationCard>

        {/* Resend */}
        <IntegrationCard icon="✉" name="Resend" connected={hasResend}
          desc="Transactional email out of the box.">
          {hasResend
            ? <ConnectedNote text="Connected — new projects can send email automatically." />
            : <ResendConnectForm redirectTo="/settings" />}
        </IntegrationCard>

        {/* Stripe payments (Pro) — let the user's apps accept payments */}
        <IntegrationCard icon="💳" name="Stripe payments" connected={hasStripe}
          desc="Let your apps accept payments — one Stripe account, reused across your projects. (Pro)">
          {!isPro
            ? <Link href="/upgrade" className="btn-ghost inline-flex items-center justify-center text-sm px-4 py-2">✨ Pro feature — upgrade</Link>
            : hasStripe
              ? <ConnectedNote text="Connected — your apps can take payments." />
              : <StripeConnectButton />}
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
    <div className="panel p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-on-surface-variant">{icon}</span>}
          <span className="font-medium text-on-surface">{name}</span>
        </div>
        {connected
          ? <span className="chip chip-success shrink-0">Connected</span>
          : <span className="chip chip-neutral shrink-0">Not connected</span>}
      </div>
      <p className="text-xs text-on-surface-variant">{desc}</p>
      {children}
    </div>
  );
}

function ConnectedNote({ text }: { text: string }) {
  return <p className="text-xs text-on-surface-variant">{text}</p>;
}
