import { createAdminClient } from "@/lib/supabase/server";
import { TRACKS, getTrack } from "@/lib/tracks";
import Link from "next/link";

type App = { name: string; vercel_preview_url: string | null; user_id: string; track: string | null };

function shotSrc(url: string | null): string | null {
  if (!url) return null;
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1024&h=720`;
}

export default async function ShowcasePage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { track: trackFilter } = await searchParams;

  let apps: App[] = [];
  const nameById = new Map<string, string>();
  try {
    const admin = await createAdminClient();
    const { data: builders } = await admin.from("profiles").select("id, github_username").not("github_username", "is", null);
    const builderList = builders ?? [];
    builderList.forEach((p) => nameById.set(p.id, p.github_username as string));
    if (builderList.length) {
      let q = admin
        .from("projects")
        .select("name, vercel_preview_url, user_id, track, created_at, status")
        .in("user_id", builderList.map((p) => p.id))
        .eq("status", "deployed")
        .not("vercel_preview_url", "is", null);
      if (trackFilter) q = q.eq("track", trackFilter);
      const { data } = await q.order("created_at", { ascending: false }).limit(60);
      apps = (data ?? []) as App[];
    }
  } catch {
    /* admin unavailable → empty gallery, never a crash */
  }

  const chips = [{ key: "", label: "All" }, ...TRACKS.map((t) => ({ key: t.key, label: `${t.icon} ${t.title}` }))];

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div>
        <p className="eyebrow">✨ Proof</p>
        <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface">Showcase</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Real apps shipped by other builders — live and owned by them. Browse for inspiration, then go build yours.
        </p>
      </div>

      {/* Filter by track */}
      <div className="flex gap-2 flex-wrap">
        {chips.map((c) => {
          const active = (trackFilter ?? "") === c.key;
          return (
            <Link key={c.key || "all"} href={c.key ? `/directory?track=${c.key}` : "/directory"}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                active ? "bg-brand-container text-brand-dim border-brand-border" : "bg-surface-low text-on-surface-variant border-outline-variant hover:border-outline"
              }`}>
              {c.label}
            </Link>
          );
        })}
      </div>

      {apps.length === 0 ? (
        <div className="text-center py-24 text-on-surface-variant space-y-3 panel">
          <p className="text-4xl">✦</p>
          <p>{trackFilter ? "No live builds in this track yet." : "No live builds yet."}</p>
          <p className="text-sm">Ship an app and it shows up here automatically.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {apps.map((p, i) => {
            const src = shotSrc(p.vercel_preview_url);
            const builder = nameById.get(p.user_id);
            const t = getTrack(p.track);
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
                  {t && <span className="text-[11px] text-on-surface-variant">{t.icon} {t.title}</span>}
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
        Want your app here? Ship one and it appears automatically.
      </p>
    </main>
  );
}
