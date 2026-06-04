import { createClient } from "@/lib/supabase/server";
import { DirectorySubmit } from "@/components/directory-submit";

type Entry = {
  id: string;
  title: string;
  tagline: string | null;
  demo_url: string | null;
  builder_name: string | null;
  created_at: string;
  live_url?: string | null;
  screenshot_url?: string | null;
  status?: string | null;
};

// Screenshot source: explicit override → live URL → demo URL, rendered through a
// free screenshot service so auth-gated apps still show *something*. Builders can
// override with their own image (the logged-in dashboard) at submit time.
function shotSrc(e: Entry): string | null {
  if (e.screenshot_url) return e.screenshot_url;
  const url = e.live_url || e.demo_url;
  if (!url) return null;
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1024&h=720`;
}

export default async function DirectoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Defensive read — new columns (live_url/screenshot_url/status) may not exist
  // until the migration is run. Fall back to the base columns.
  let entries: Entry[] = [];
  try {
    const { data, error } = await supabase
      .from("wall_submissions")
      .select("id, title, tagline, demo_url, builder_name, created_at, live_url, screenshot_url, status")
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) throw error;
    entries = (data as Entry[] | null) ?? [];
  } catch {
    const { data } = await supabase
      .from("wall_submissions")
      .select("id, title, tagline, demo_url, builder_name, created_at")
      .order("created_at", { ascending: false })
      .limit(120);
    entries = (data as Entry[] | null) ?? [];
  }
  // Only show entries Pilot considers live (when the status column exists).
  entries = entries.filter((e) => !e.status || e.status === "live");

  // The current user's deployed projects, available to add to the directory.
  let myProjects: { id: string; name: string }[] = [];
  if (user) {
    const { data } = await supabase
      .from("projects")
      .select("id, name, status")
      .eq("user_id", user.id)
      .eq("status", "deployed")
      .order("created_at", { ascending: false });
    myProjects = ((data as Array<{ id: string; name: string }> | null) ?? []).map((p) => ({ id: p.id, name: p.name }));
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Showcase</p>
          <h1 className="text-2xl font-bold font-display tracking-tight text-on-surface">Directory</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Real, working AI systems shipped through OnlyAIApp — proof, not prompts.
          </p>
        </div>
        {myProjects.length > 0 && <DirectorySubmit projects={myProjects} />}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-24 text-on-surface-variant space-y-3 panel">
          <p className="text-4xl">🏛</p>
          <p>No apps in the Directory yet.</p>
          {myProjects.length > 0
            ? <p className="text-sm">Shipped something? Add it above to be the first.</p>
            : <p className="text-sm">Ship a project, then add it here to showcase it.</p>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {entries.map((e) => {
            const src = shotSrc(e);
            const visit = e.live_url || e.demo_url || null;
            return (
              <div key={e.id} className="panel overflow-hidden flex flex-col hover:bg-surface-high transition-colors group">
                {/* Screenshot */}
                <div className="aspect-[16/10] bg-surface-high border-b border-outline-variant overflow-hidden">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={e.title} loading="lazy"
                      className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-outline text-3xl">🖥</div>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-on-surface truncate">{e.title}</h3>
                  </div>
                  {e.tagline && <p className="text-xs text-on-surface-variant line-clamp-2">{e.tagline}</p>}
                  <div className="flex items-center justify-between gap-2 mt-auto pt-2">
                    <span className="text-[11px] text-outline truncate">by {e.builder_name ?? "a builder"}</span>
                    {visit && (
                      <a href={visit} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-brand hover:text-brand-dim shrink-0">Visit →</a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-outline">
        Apps are checked for uptime; ones that go down are hidden automatically.
      </p>
    </main>
  );
}
