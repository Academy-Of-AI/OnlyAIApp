import { createAdminClient } from "@/lib/supabase/server";
import { normalizePlan } from "@/lib/plan";
import Link from "next/link";
import { notFound } from "next/navigation";

function shotSrc(url: string | null): string | null {
  if (!url) return null;
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1024&h=720`;
}

export default async function PublicProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Public profiles are a Pro feature (opt-in by being Pro) — keeps private builds
  // private. Any infra error (e.g. admin client unavailable) resolves to a clean
  // 404, never a 500.
  type Pub = { name: string; vercel_preview_url: string | null };
  let apps: Pub[] = [];
  let found = false;
  try {
    const admin = await createAdminClient();
    const { data: profile } = await admin
      .from("profiles").select("id, plan").eq("github_username", slug).maybeSingle();
    if (profile && normalizePlan(profile.plan) === "pro") {
      found = true;
      const { data: projects } = await admin
        .from("projects")
        .select("name, vercel_preview_url, status")
        .eq("user_id", profile.id)
        .eq("status", "deployed")
        .order("created_at", { ascending: false })
        .limit(24);
      apps = ((projects ?? []) as Pub[]).filter((p) => p.vercel_preview_url);
    }
  } catch {
    /* fall through to a clean 404 */
  }
  if (!found) notFound();

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top bar */}
      <nav className="border-b border-outline-variant px-5 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-display font-bold tracking-tight text-on-surface">OnlyAIApp</span>
          <span className="hidden sm:inline text-[10px] font-bold tracking-[0.14em] uppercase text-brand">Build Studio</span>
        </div>
        <Link href="/sign-in" className="btn-brand text-sm px-4 py-1.5">Build yours →</Link>
      </nav>

      {/* Header */}
      <header className="px-5 sm:px-6 py-12 text-center">
        <span className="w-16 h-16 rounded-2xl grid place-items-center text-white text-2xl font-bold mx-auto" style={{ background: "linear-gradient(135deg, var(--color-brand), #d946ef)" }}>
          {slug.slice(0, 2).toUpperCase()}
        </span>
        <h1 className="font-display font-extrabold text-3xl tracking-tight text-on-surface mt-4">{slug}</h1>
        <p className="text-on-surface-variant mt-1">
          AI builder · {apps.length} real app{apps.length === 1 ? "" : "s"} shipped &amp; live
        </p>
      </header>

      {/* Apps */}
      <section className="flex-1 px-5 sm:px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          {apps.length === 0 ? (
            <div className="panel p-12 text-center text-on-surface-variant">
              <p className="text-3xl">🌱</p>
              <p className="mt-2">No live apps yet — check back soon.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {apps.map((p) => {
                const src = shotSrc(p.vercel_preview_url);
                return (
                  <a key={p.name} href={p.vercel_preview_url ?? "#"} target="_blank" rel="noopener noreferrer"
                    className="panel overflow-hidden flex flex-col hover:bg-surface-high transition-colors group">
                    <div className="aspect-[16/10] bg-surface-high border-b border-outline-variant overflow-hidden">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt={p.name} loading="lazy" className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform" />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-outline text-3xl">🖥</div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col gap-1.5 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display font-semibold text-on-surface truncate">{p.name}</h3>
                        <span className="chip chip-success shrink-0"><span className="dot" style={{ background: "var(--color-success)" }} />Live</span>
                      </div>
                      <span className="text-xs text-brand group-hover:text-brand-dim mt-auto pt-2">Visit →</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-outline-variant px-6 py-6 text-center text-xs text-outline">
        Built &amp; shipped with{" "}
        <Link href="/" className="text-on-surface-variant hover:text-on-surface">OnlyAIApp</Link> — build real AI apps, walk away with proof.
      </footer>
    </main>
  );
}
