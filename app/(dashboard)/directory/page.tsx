import { createClient } from "@/lib/supabase/server";

type Proj = {
  id: string;
  name: string;
  build_prompt: string | null;
  vercel_preview_url: string | null;
  created_at: string;
};

// Free screenshot service so even auth-gated apps show *something* live.
function shotSrc(url: string | null): string | null {
  if (!url) return null;
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1024&h=720`;
}

// A short tagline from the build prompt (first sentence / line).
function tagline(p: Proj): string | null {
  const raw = (p.build_prompt ?? "").trim();
  if (!raw) return null;
  const first = raw.split(/\n|\.\s/)[0].trim();
  return first.length > 110 ? first.slice(0, 110) + "…" : first;
}

export default async function InspirationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Auto-showcase every live (deployed) app — no manual submission needed.
  const { data } = await supabase
    .from("projects")
    .select("id, name, build_prompt, vercel_preview_url, created_at")
    .eq("user_id", user!.id)
    .eq("status", "deployed")
    .order("created_at", { ascending: false })
    .limit(60);
  const apps = ((data as Proj[] | null) ?? []).filter((p) => p.vercel_preview_url);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div>
        <p className="eyebrow">Inspiration</p>
        <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface">Inspiration</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Real, working AI systems shipped through OnlyAIApp — every live app, automatically.
        </p>
      </div>

      {apps.length === 0 ? (
        <div className="text-center py-24 text-on-surface-variant space-y-3 panel">
          <p className="text-4xl">✦</p>
          <p>Nothing live yet.</p>
          <p className="text-sm">Ship a project and it shows up here automatically.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {apps.map((p) => {
            const src = shotSrc(p.vercel_preview_url);
            const tag = tagline(p);
            return (
              <a key={p.id} href={p.vercel_preview_url ?? "#"} target="_blank" rel="noopener noreferrer"
                className="panel overflow-hidden flex flex-col hover:bg-surface-high transition-colors group">
                <div className="aspect-[16/10] bg-surface-high border-b border-outline-variant overflow-hidden">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={p.name} loading="lazy"
                      className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-outline text-3xl">🖥</div>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-semibold text-on-surface truncate">{p.name}</h3>
                    <span className="chip chip-success shrink-0"><span className="dot" style={{ background: "var(--color-success)" }} />Live</span>
                  </div>
                  {tag && <p className="text-xs text-on-surface-variant line-clamp-2">{tag}</p>}
                  <span className="text-xs text-brand group-hover:text-brand-dim mt-auto pt-2">Visit →</span>
                </div>
              </a>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-outline">
        Every deployed app is showcased automatically. Pilot checks them for uptime.
      </p>
    </main>
  );
}
