import { OpsPanel } from "@/components/ops-panel";
import { DomainForm } from "@/components/domain-form";
import { IntegrationKeyForm } from "@/components/integration-key-form";
import { ShowcaseControls } from "@/components/showcase-controls";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { normalizePlan } from "@/lib/plan";
import { listVercelEnvVars } from "@/lib/vercel";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Bring-your-own-key integrations (Pro). The user pastes their own keys; we inject
// them into this project's Vercel env. detect = the env key that marks it "Added".
const INTEGRATIONS = [
  { key: "stripe", name: "Accept payments", icon: "💳", desc: "via Stripe", detect: "STRIPE_SECRET_KEY",
    fields: [
      { env: "STRIPE_SECRET_KEY", label: "Secret key", placeholder: "sk_live_… or sk_test_…" },
      { env: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", label: "Publishable key", placeholder: "pk_live_… or pk_test_…" },
    ] },
  { key: "sentry", name: "Error monitoring", icon: "🛡️", desc: "via Sentry", detect: "SENTRY_DSN",
    fields: [{ env: "SENTRY_DSN", label: "Sentry DSN", placeholder: "https://…ingest.sentry.io/…" }] },
  { key: "posthog", name: "Product analytics", icon: "📈", desc: "via PostHog", detect: "NEXT_PUBLIC_POSTHOG_KEY",
    fields: [
      { env: "NEXT_PUBLIC_POSTHOG_KEY", label: "Project API key", placeholder: "phc_…" },
      { env: "NEXT_PUBLIC_POSTHOG_HOST", label: "Host", placeholder: "https://us.i.posthog.com" },
    ] },
  { key: "upstash", name: "Caching & rate-limit", icon: "⚡", desc: "via Upstash", detect: "UPSTASH_REDIS_REST_URL",
    fields: [
      { env: "UPSTASH_REDIS_REST_URL", label: "REST URL", placeholder: "https://…upstash.io" },
      { env: "UPSTASH_REDIS_REST_TOKEN", label: "REST token", placeholder: "A…" },
    ] },
];

export default async function OpsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: project } = await supabase
    .from("projects").select("*").eq("id", id).eq("user_id", user!.id).single();
  if (!project) notFound();

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user!.id).single();
  const isPro = normalizePlan(profile?.plan) === "pro";

  // Load current env vars (keys only) for display
  let envs: { key: string; target: string[]; type: string }[] = [];
  if (project.vercel_project_id) {
    const { data: conn } = await supabase
      .from("oauth_connections").select("access_token, metadata")
      .eq("user_id", user!.id).eq("provider", "vercel").single();
    if (conn) {
      try {
        const token = await decrypt(conn.access_token as string);
        const meta = conn.metadata as { team_id?: string | null } | null;
        envs = await listVercelEnvVars({
          token, projectId: project.vercel_project_id as string, teamId: meta?.team_id ?? undefined,
        });
      } catch { /* show empty */ }
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-center gap-2 text-sm text-on-surface-variant mb-6">
        <Link href="/mission-control" className="hover:text-on-surface transition-colors">Mission Control</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-on-surface transition-colors">{project.name}</Link>
        <span>/</span>
        <span className="text-on-surface">Manage</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight font-display text-on-surface mb-1">Manage this app · {project.name}</h1>
      <p className="text-sm text-on-surface-variant mb-8">Show it off, add payments &amp; integrations, and tweak settings — all for this one app.</p>

      {/* 1 · Showcase (free) — lead with what everyone uses */}
      <section className="space-y-3">
        <h2 className="font-semibold text-on-surface flex items-center gap-2">✨ Showcase</h2>
        <p className="text-sm text-on-surface-variant">Choose whether this app appears on the public Showcase, and set its thumbnail (so a login page doesn’t show).</p>
        <div className="panel p-4">
          <ShowcaseControls projectId={id} published={!!project.showcase_published} image={project.showcase_image ?? null} />
        </div>
      </section>

      {/* 2 · Integrations (Pro) — make it production-grade */}
      <section className="mt-10 space-y-3">
        <h2 className="font-semibold text-on-surface flex items-center gap-2">🔌 Integrations <span className="chip chip-brand">Pro</span></h2>
        <p className="text-sm text-on-surface-variant">Make this app production-grade — accept payments and add monitoring. Paste your own keys; we inject them into this app’s environment, then redeploy to apply.</p>
        {isPro ? (
          <div className="space-y-3">
            {INTEGRATIONS.map((it) => (
              <IntegrationKeyForm key={it.key} projectId={id} name={it.name} icon={it.icon} desc={it.desc}
                fields={it.fields} connected={envs.some((e) => e.key === it.detect)} />
            ))}
          </div>
        ) : (
          <Link href="/upgrade" className="btn-ghost inline-flex text-sm px-4 py-2">✨ Pro feature — upgrade</Link>
        )}
      </section>

      {/* 3 · Custom domain (Pro) — de-emphasized; free onlyaiapp.com address already works */}
      <section className="mt-10 space-y-3">
        <h2 className="font-semibold text-on-surface flex items-center gap-2">🌐 Custom domain <span className="chip chip-brand">Pro</span></h2>
        <p className="text-sm text-on-surface-variant">Optional — your app is already live at a free onlyaiapp.com address. Add your own domain (e.g. app.yoursite.com) only if you want one.</p>
        {isPro
          ? <DomainForm projectId={id} />
          : <Link href="/upgrade" className="btn-ghost inline-flex text-sm px-4 py-2">✨ Pro feature — upgrade</Link>}
      </section>

      {/* 4 · Advanced — env vars + rollback, tucked away (collapsed by default) */}
      <details className="mt-10 group">
        <summary className="cursor-pointer list-none flex items-center gap-2 font-semibold text-on-surface select-none">
          <span className="text-on-surface-variant text-xs transition-transform group-open:rotate-90">▶</span>
          Advanced
          <span className="text-xs font-normal text-on-surface-variant">Environment variables &amp; deploy rollback</span>
        </summary>
        <p className="text-sm text-on-surface-variant mt-2 mb-4">For when you know what you’re doing — most people never need to touch this.</p>
        <OpsPanel projectId={id} initialEnvs={envs} />
      </details>
    </main>
  );
}
