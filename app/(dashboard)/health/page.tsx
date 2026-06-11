import { createClient } from "@/lib/supabase/server";
import { healthReadLimit, normalizePlan } from "@/lib/plan";
import { RepoHealth } from "@/components/repo-health";

export const dynamic = "force-dynamic";

/**
 * /health — the existing-repo "Plan + drift health read."
 *
 * Point the Pilot at a repo you already own → get a draft, reverse-engineered
 * plan + an objective-standards health report. READ-ONLY: we never touch the
 * repo. This is the Pilot's three engines (shape / prove / show) run on someone
 * else's code — the lead magnet and the first data engine for Phase 1.
 */
export default async function HealthPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: gh }, { data: profile }, { data: reads, count }] = await Promise.all([
    supabase.from("oauth_connections").select("provider").eq("user_id", user!.id).eq("provider", "github").maybeSingle(),
    supabase.from("profiles").select("plan").eq("id", user!.id).maybeSingle(),
    supabase.from("repo_health_reads")
      .select("id, repo_full_name, score, grade, summary, stack, draft_plan, findings, ai_used, notes, created_at", { count: "exact" })
      .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const plan = normalizePlan(profile?.plan as string | null);
  const limit = healthReadLimit(plan);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <p className="eyebrow">Pilot · Repo Health</p>
        <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface">
          Read an existing repo — draft plan + health check
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Point the Pilot at a repo you already own. It reads the code (read-only — it never changes anything),
          reverse-engineers a <b className="text-on-surface">draft plan</b> you can edit, and checks it against
          objective build standards for the issues that quietly break real apps.
        </p>
      </div>

      <RepoHealth
        githubConnected={!!gh}
        used={count ?? 0}
        limit={limit === Infinity ? null : limit}
        plan={plan}
        initialReads={(reads ?? []) as never[]}
      />
    </main>
  );
}
