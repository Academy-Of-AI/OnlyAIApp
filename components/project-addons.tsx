import Link from "next/link";
import { IntegrationKeyForm } from "@/components/integration-key-form";
import { DomainForm } from "@/components/domain-form";

/* Bring-your-own-key add-ons (per app). The user pastes their own keys; we inject them
   into THIS project's Vercel env. detect = the env key that marks it "Added". Provider
   names live only on the field hints — the card titles stay purpose-first. */
const PAYMENTS = {
  key: "stripe", name: "Accept payments", icon: "💳", desc: "let this app charge customers (Stripe)", detect: "STRIPE_SECRET_KEY",
  fields: [
    { env: "STRIPE_SECRET_KEY", label: "Secret key", placeholder: "Stripe secret key — sk_live_… / sk_test_…" },
    { env: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", label: "Publishable key", placeholder: "Stripe publishable key — pk_live_…" },
  ],
};
const HARDENING = [
  { key: "sentry", name: "Error monitoring", icon: "🛡️", desc: "catch crashes in production", detect: "SENTRY_DSN",
    fields: [{ env: "SENTRY_DSN", label: "DSN", placeholder: "Sentry DSN — https://…ingest.sentry.io/…" }] },
  { key: "posthog", name: "Product analytics", icon: "📈", desc: "see how people use it", detect: "NEXT_PUBLIC_POSTHOG_KEY",
    fields: [
      { env: "NEXT_PUBLIC_POSTHOG_KEY", label: "Project key", placeholder: "PostHog project key — phc_…" },
      { env: "NEXT_PUBLIC_POSTHOG_HOST", label: "Host", placeholder: "PostHog host — https://us.i.posthog.com" },
    ] },
  { key: "upstash", name: "Caching & rate-limit", icon: "⚡", desc: "stay fast & abuse-proof", detect: "UPSTASH_REDIS_REST_URL",
    fields: [
      { env: "UPSTASH_REDIS_REST_URL", label: "REST URL", placeholder: "Upstash REST URL — https://…upstash.io" },
      { env: "UPSTASH_REDIS_REST_TOKEN", label: "REST token", placeholder: "Upstash REST token" },
    ] },
];

function LockedAddon({ icon, name, sub }: { icon: string; name: string; sub: string }) {
  return (
    <div className="panel p-4 bg-surface-dim flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <span>{icon}</span>
        <span className="font-medium text-on-surface-variant">{name}</span>
        <span className="text-xs text-on-surface-variant truncate hidden sm:inline">· {sub}</span>
        <span className="chip chip-brand shrink-0">Pro</span>
      </div>
      <Link href="/upgrade" className="text-xs text-brand-dim hover:underline shrink-0">✨ Unlock with Pro →</Link>
    </div>
  );
}

/** Per-app add-ons rendered INLINE in the project's Settings tab (no separate page). */
export function ProjectAddOns({
  projectId, isPro, canDomain, envKeys,
}: {
  projectId: string; isPro: boolean; canDomain: boolean; envKeys: string[];
}) {
  const has = (k: string) => envKeys.includes(k);

  return (
    <div className="space-y-6">
      {/* App add-ons (Pro) */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
            App add-ons <span className="chip chip-brand">Pro</span>
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Paste your own keys for <b className="text-on-surface">this app</b>. Different apps can use different
            accounts/orgs, so keys are per-app — we inject them, then redeploy to apply.
          </p>
        </div>

        {isPro ? (
          <>
            {/* Accept payments */}
            <IntegrationKeyForm projectId={projectId} name={PAYMENTS.name} icon={PAYMENTS.icon} desc={PAYMENTS.desc}
              fields={PAYMENTS.fields} connected={has(PAYMENTS.detect)} />

            {/* Production hardening — grouped */}
            <div className="pt-1">
              <p className="text-xs font-semibold text-on-surface flex items-center gap-1.5 mb-2">
                🛡️ Production hardening
                <span className="font-normal text-on-surface-variant">— make it production-grade</span>
              </p>
              <div className="space-y-2.5">
                {HARDENING.map((it) => (
                  <IntegrationKeyForm key={it.key} projectId={projectId} name={it.name} icon={it.icon} desc={it.desc}
                    fields={it.fields} connected={has(it.detect)} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2.5">
            <LockedAddon icon="💳" name="Accept payments" sub="Stripe" />
            <LockedAddon icon="🛡️" name="Production hardening" sub="monitoring, analytics & caching" />
          </div>
        )}
      </div>

      {/* Custom domain (Core + Pro) */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
          🌐 Custom domain
          {!canDomain && <span className="chip chip-neutral">Core</span>}
        </h3>
        <p className="text-xs text-on-surface-variant">
          Optional — this app already has a free address. Point your own domain (e.g. app.yoursite.com) if you want one.
        </p>
        {canDomain
          ? <DomainForm projectId={projectId} />
          : <Link href="/upgrade" className="btn-ghost inline-flex text-sm px-4 py-2">Available on Core &amp; Pro — upgrade →</Link>}
      </div>

      {/* Advanced — the deepest layer (env vars + rollback) */}
      <details className="group rounded-xl border border-dashed border-outline-variant px-4 py-3">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-2 select-none">
          <span className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <span className="text-on-surface-variant text-xs transition-transform group-open:rotate-90">▶</span>
            Advanced
            <span className="hidden sm:inline text-xs font-normal text-on-surface-variant">Environment variables &amp; deploy rollback</span>
          </span>
          <Link href={`/projects/${projectId}/ops`} className="text-xs text-brand-dim hover:underline shrink-0">Open →</Link>
        </summary>
        <p className="text-xs text-on-surface-variant mt-2">
          Raw environment variables and one-click rollback to a previous deploy. Most people never need to touch this.
        </p>
      </details>
    </div>
  );
}
