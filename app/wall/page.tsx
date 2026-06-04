import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WallUpvote } from "@/components/wall-upvote";

export const metadata = {
  title: "The Wall — real AI systems, shipped",
  description: "Real, working AI systems built and shipped by OnlyAIApp builders. Not prompts. Not demos. Systems that run.",
};

type Submission = {
  id: string; title: string; tagline: string | null; demo_url: string;
  builder_name: string | null; upvotes: number; featured: boolean; created_at: string;
};

export default async function WallPage() {
  const supabase = await createClient();
  let subs: Submission[] = [];
  try {
    const { data } = await supabase
      .from("wall_submissions")
      .select("id, title, tagline, demo_url, builder_name, upvotes, featured, created_at")
      .order("featured", { ascending: false })
      .order("upvotes", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(120);
    subs = (data as Submission[] | null) ?? [];
  } catch { subs = []; }

  return (
    <main className="min-h-screen bg-surface text-on-surface flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
        <Link href="/" className="font-bold tracking-tight font-display text-on-surface">OnlyAIApp</Link>
        <Link href="/sign-up" className="btn-brand text-sm text-white px-3 py-1.5 transition-colors">
          Build yours →
        </Link>
      </nav>

      <section className="text-center px-5 sm:px-6 py-14 sm:py-20 border-b border-outline-variant">
        <div className="inline-flex items-center gap-2 bg-brand-container text-brand-dim text-xs px-3 py-1 rounded-full border border-brand-border mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" /> The Wall
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.1] font-display text-on-surface">
          Real systems, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-fuchsia-400">shipped</span>
        </h1>
        <p className="text-on-surface-variant text-lg max-w-xl mx-auto mt-5">
          Not prompts. Not demos. Working AI systems built and shipped by OnlyAIApp builders — each one runs without them.
        </p>
      </section>

      <section className="flex-1 px-5 sm:px-6 py-12 max-w-5xl mx-auto w-full">
        {subs.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant space-y-3">
            <p className="text-4xl">🧱</p>
            <p>No builds on The Wall yet.</p>
            <Link href="/sign-up" className="text-brand hover:underline text-sm">Be the first to ship one →</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {subs.map((s) => (
              <div key={s.id} className="panel p-5 flex flex-col gap-3 hover:border-outline transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug text-on-surface">{s.title}</h3>
                  {s.featured && <span className="chip chip-warn shrink-0">★ Featured</span>}
                </div>
                {s.tagline && <p className="text-sm text-on-surface-variant leading-relaxed flex-1">{s.tagline}</p>}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-outline truncate">by {s.builder_name ?? "a builder"}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <WallUpvote id={s.id} initial={s.upvotes} />
                    <a href={s.demo_url} target="_blank" rel="noopener noreferrer"
                      className="btn-ghost text-sm px-3 py-1.5 transition-colors">
                      Demo ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-outline-variant px-6 py-6 text-center text-xs text-outline">
        OnlyAIApp — own a working AI system, built by you
      </footer>
    </main>
  );
}
