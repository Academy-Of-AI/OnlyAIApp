import { createAdminClient } from "@/lib/supabase/server";
import Link from "next/link";

type App = { name: string; vercel_preview_url: string | null; user_id: string };

// Free screenshot service so even auth-gated apps show *something* live.
function shotSrc(url: string | null): string | null {
  if (!url) return null;
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1024&h=720`;
}

export default async function ShowcasePage() {
  // Showcase = a discovery wall of OTHER builders' live apps. Only public (Pro)
  // builders appear — same gate as public profiles — so private builds stay private.
  let apps: App[] = [];
  const nameById = new Map<string, string>();
  try {
    const admin = await createAdminClient();
    const { data: pros } = await admin
      .from("profiles").select("id, github_username").eq("plan", "pro");
    const proList = (pros ?? []).filter((p) => p.github_username);
    proList.forEach((p) => nameById.set(p.id, p.github_username as string));
    if (proList.length) {
      const { data } = await admin
        .from("projects")
        .select("name, vercel_preview_url, user_id, created_at, status")
        .in("user_id", proList.map((p) => p.id))
        .eq("status", "deployed")
        .not("vercel_preview_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);
      apps = (data ?? []) as App[];
    }
  } catch {
    /* admin unavailable → empty gallery, never a crash */
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div>
        <p className="eyebrow">✨ Proof</p>
        <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface">Showcase</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Real apps shipped by other builders — live and owned by them. Browse for inspiration, then go build yours.
        </p>
      </div>

      {apps.length === 0 ? (
        <div className="text-center py-24 text-on-surface-variant space-y-3 panel">
          <p className="text-4xl">✦</p>
          <p>No public builds yet.</p>
          <p className="text-sm">Ship an app and publish your Portfolio (Pro) to appear here.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {apps.map((p, i) => {
            const src = shotSrc(p.vercel_preview_url);
            const builder = nameById.get(p.user_id);
            return (
              <div key={`${p.user_id}-${i}`} className="panel overflow-hidden flex flex-col hover:bg-surface-high transition-colors group">
                <a href={p.vercel_preview_url ?? "#"} target="_blank" rel="noopener noreferrer"
                  className="aspect-[16/10] bg-surface-high border-b border-outline-variant overflow-hidden block">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={p.name} loading="lazy"
                      className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-outline text-3xl">🖥</div>
                  )}
                </a>
                <div className="p-4 flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-semibold text-on-surface truncate">{p.name}</h3>
                    <span className="chip chip-success shrink-0"><span className="dot" style={{ background: "var(--color-success)" }} />Live</span>
                  </div>
                  {builder && (
                    <Link href={`/u/${builder}`} className="text-xs text-on-surface-variant hover:text-on-surface truncate">by {builder} →</Link>
                  )}
                  <a href={p.vercel_preview_url ?? "#"} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-brand group-hover:text-brand-dim mt-auto pt-2">Visit →</a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-outline">
        Want your apps here? Ship them and publish your Portfolio on Pro.
      </p>
    </main>
  );
}
