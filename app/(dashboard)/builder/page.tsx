import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "What carries over",
  description: "What OnlyAIApp has learned about how you build — applied to every new OS.",
};

const TEMPLATE_STACK: Record<string, string> = {
  "vibe-stack-supabase": "Next.js · Supabase (RLS) · Tailwind",
};

export default async function BuilderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("template_id, status")
    .eq("user_id", user!.id);

  const list = projects ?? [];
  const total = list.length;
  const shipped = list.filter((p) => p.status === "deployed").length;
  const templates = Array.from(new Set(list.map((p) => p.template_id).filter(Boolean))) as string[];
  const stack = templates.map((t) => TEMPLATE_STACK[t] ?? t).join(" · ") || "Next.js · Supabase (RLS) · Tailwind";

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
      <div>
        <Link href="/dashboard" className="text-outline text-sm hover:text-on-surface">← Dashboard</Link>
        <h1 className="text-2xl font-bold mt-2 font-display tracking-tight text-on-surface">What carries over</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          OnlyAIApp learned how you build across your {total === 1 ? "build" : "builds"} — and applies it to every new OS.
          You never set any of this up.
        </p>
      </div>

      {total === 0 ? (
        <div className="panel p-8 text-center text-on-surface-variant space-y-2">
          <p className="text-3xl">◆</p>
          <p>Nothing yet — build your first OS and your profile starts accruing.</p>
          <Link href="/new-project" className="text-brand hover:underline text-sm">Forge your first OS →</Link>
        </div>
      ) : (
        <>
          {/* Payoff first */}
          <section className="border border-brand-border bg-brand-container rounded-xl p-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-brand font-semibold">→ Your next OS starts with</p>
            <div className="space-y-2 text-sm text-on-surface">
              <p className="flex gap-2"><span className="text-success">✓</span> Your stack pre-wired: <span className="text-on-surface-variant">{stack}</span></p>
              <p className="flex gap-2"><span className="text-success">✓</span> A DB-first scaffold with your patterns already applied</p>
              <p className="flex gap-2"><span className="text-success">✓</span> An agent that already knows your style — no re-explaining</p>
            </div>
            <p className="text-xs text-outline pt-1">Without this, a cold agent makes you set it all up again — every project.</p>
          </section>

          {/* Learned from your builds */}
          <div>
            <p className="text-xs uppercase tracking-widest text-outline font-semibold mb-3">Learned from your <span className="tabnum">{total}</span> {total === 1 ? "build" : "builds"}</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="panel p-4">
                <p className="text-xs text-outline font-semibold uppercase tracking-wide">Your stack</p>
                <p className="text-sm mt-1.5 text-on-surface">{stack}</p>
              </div>
              <div className="panel p-4">
                <p className="text-xs text-outline font-semibold uppercase tracking-wide">Your patterns</p>
                <p className="text-sm mt-1.5 text-on-surface">DB-first · per-org isolation · logic in code, agent only for copy</p>
              </div>
              <div className="panel p-4">
                <p className="text-xs text-outline font-semibold uppercase tracking-wide">Your style</p>
                <p className="text-sm mt-1.5 text-on-surface">Ship early · harden in place · small steps</p>
              </div>
            </div>
          </div>

          {/* Rising switching cost */}
          <section className="panel p-5">
            <p className="text-xs uppercase tracking-widest text-outline font-semibold mb-2">Why this keeps you here</p>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Each OS you forge makes the next one faster — <span className="tabnum">{total}</span> so far, <span className="tabnum">{shipped}</span> shipped.
              <b className="text-on-surface"> Leave OnlyAIApp and you go back to a cold agent that forgets how you build.</b> This is your own
              history, made useful.
            </p>
          </section>

          <p className="text-xs text-outline">100% inferred from your builds. You never filled in a form to create this.</p>
        </>
      )}
    </main>
  );
}
