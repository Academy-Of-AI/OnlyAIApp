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
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link href="/" className="font-bold tracking-tight">OnlyAIApp</Link>
        <Link href="/sign-up" className="text-sm bg-violet-500 hover:bg-violet-400 text-white font-medium px-3 py-1.5 rounded-md transition-colors">
          Build yours →
        </Link>
      </nav>

      <section className="text-center px-5 sm:px-6 py-14 sm:py-20 border-b border-white/10">
        <div className="inline-flex items-center gap-2 bg-white/10 text-white/70 text-xs px-3 py-1 rounded-full border border-white/20 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> The Wall
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl mx-auto leading-[1.1]">
          Real systems, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-300">shipped</span>
        </h1>
        <p className="text-neutral-400 text-lg max-w-xl mx-auto mt-5">
          Not prompts. Not demos. Working AI systems built and shipped by OnlyAIApp builders — each one runs without them.
        </p>
      </section>

      <section className="flex-1 px-5 sm:px-6 py-12 max-w-5xl mx-auto w-full">
        {subs.length === 0 ? (
          <div className="text-center py-20 text-neutral-500 space-y-3">
            <p className="text-4xl">🧱</p>
            <p>No builds on The Wall yet.</p>
            <Link href="/sign-up" className="text-violet-400 hover:underline text-sm">Be the first to ship one →</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {subs.map((s) => (
              <div key={s.id} className="border border-white/10 rounded-xl p-5 flex flex-col gap-3 hover:border-white/25 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-snug">{s.title}</h3>
                  {s.featured && <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full shrink-0">★ Featured</span>}
                </div>
                {s.tagline && <p className="text-sm text-neutral-400 leading-relaxed flex-1">{s.tagline}</p>}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-neutral-600 truncate">by {s.builder_name ?? "a builder"}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <WallUpvote id={s.id} initial={s.upvotes} />
                    <a href={s.demo_url} target="_blank" rel="noopener noreferrer"
                      className="text-sm bg-white/5 border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors">
                      Demo ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-neutral-600">
        OnlyAIApp — own a working AI system, built by you
      </footer>
    </main>
  );
}
