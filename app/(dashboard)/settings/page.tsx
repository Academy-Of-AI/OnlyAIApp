import { VercelConnectForm } from "@/components/vercel-connect-form";
import { SupabaseConnectForm } from "@/components/supabase-connect-form";
import { ResendConnectForm } from "@/components/resend-connect-form";
import { PilotTerminalSection } from "@/components/pilot-terminal-section";
import { createClient } from "@/lib/supabase/server";
import { apiLimit, currentApiPeriod } from "@/lib/plan";
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
  const plan = profile?.plan ?? "free";
  const isPro = plan === "pro";

  // Pilot-API tokens + this month's usage — only Pro needs them (free/core see
  // the upgrade CTA). Resilient if the table isn't there yet (null → empty).
  let pilotTokens: { id: string; name: string; last_four: string; created_at: string; last_used_at: string | null }[] = [];
  let pilotUsed = 0;
  if (isPro) {
    const [{ data: tk }, { count }] = await Promise.all([
      supabase.from("api_tokens")
        .select("id,name,last_four,created_at,last_used_at")
        .eq("user_id", user.id).is("revoked_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("api_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id).eq("period", currentApiPeriod()),
    ]);
    pilotTokens = tk ?? [];
    pilotUsed = count ?? 0;
  }

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
          {connectErrorMessage(params.error)}
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

      {/* Pilot in your terminal — the user's OWN developer access (distinct from
          the project-provisioning integrations below). Pro = setup; non-Pro = upsell. */}
      <PilotTerminalSection isPro={isPro} tokens={pilotTokens} used={pilotUsed} limit={apiLimit(plan)} />

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

        {/* Vercel — "Connected" is the token; deploys ALSO need the Vercel GitHub
            app to have repo access. Surface that second step here so Settings
            tells the same story as the Home checklist (and matches the #1
            provisioning failure: "Vercel permissions"). */}
        <IntegrationCard icon="▲" name="Vercel" connected={hasVercel}
          desc="Deploy live with a public URL + CI/CD.">
          {hasVercel
            ? (
              <div className="space-y-2.5">
                <ConnectedNote text="Connected — new projects deploy automatically." />
                <div className="rounded-lg border border-outline-variant bg-surface-low px-3 py-2.5 text-xs text-on-surface-variant">
                  <p className="text-on-surface font-medium mb-0.5">One more thing for deploys</p>
                  Vercel also needs its GitHub app to have access to your repos. If setup ever fails with a
                  {" "}<span className="text-on-surface">“Vercel permissions”</span> error, grant access here — choose
                  {" "}<b className="text-on-surface">All repositories</b>, then retry.
                  <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                    <a href="https://github.com/apps/vercel/installations/new" target="_blank" rel="noopener noreferrer"
                      className="text-brand hover:text-brand-dim font-medium">Manage Vercel repo access →</a>
                    <a href="/api/vercel/oauth" className="text-on-surface-variant hover:text-on-surface">Reconnect Vercel</a>
                  </div>
                </div>
              </div>
            )
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

        <div className="panel p-5 bg-surface-dim">
          <p className="text-sm text-on-surface-variant">
            <b className="text-on-surface">App add-ons are per-app</b> — payments, production hardening (your own keys)
            &amp; a custom domain live on each project, so different apps can use different accounts/orgs. Open a project from{" "}
            <Link href="/projects" className="text-brand-dim hover:underline">Projects</Link> → its <b className="text-on-surface">Settings</b> tab.
          </p>
        </div>
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

/** Honest, actionable copy for connect errors — never "try again" on a config
 *  failure that retrying can't fix. Points the user at the working paste path,
 *  which is right below on this page. */
function connectErrorMessage(code: string): string {
  if (code === "vercel_oauth_unconfigured")
    return "One-click Vercel connect isn’t switched on yet — but you can still connect Vercel in about 30 seconds: in the Vercel card below, paste an access token (the “How to get your token” link walks you through it).";
  if (code === "supabase_oauth_unconfigured")
    return "One-click Supabase connect isn’t switched on yet — connect it in the Supabase card below by pasting a token instead.";
  return "That connection didn’t go through. Try connecting again in the matching card below, or use its paste-a-token option.";
}
