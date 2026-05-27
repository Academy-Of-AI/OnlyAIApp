"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<string>("");
  const [error, setError] = useState("");

  const steps = [
    "Creating GitHub repo from template…",
    "Linking Vercel project…",
    "Injecting environment variables…",
    "Triggering first deploy…",
  ];

  async function provision(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Simulate progress steps while API runs
    let i = 0;
    const interval = setInterval(() => {
      setStep(steps[i % steps.length]);
      i++;
    }, 1800);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, supabaseUrl, supabaseAnonKey }),
      });

      clearInterval(interval);

      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? "Provisioning failed");
        setLoading(false);
        return;
      }

      const { githubRepoUrl, vercelPreviewUrl } = await res.json();
      router.push(`/dashboard?provisioned=1&github=${encodeURIComponent(githubRepoUrl)}&url=${encodeURIComponent(vercelPreviewUrl)}`);
    } catch {
      clearInterval(interval);
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-6 py-12 space-y-8">
      <div>
        <Link href="/dashboard" className="text-neutral-500 text-sm hover:text-white">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-2">New project</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Fill in a name below and we&apos;ll handle the rest — automatically, in about 60 seconds.
        </p>
      </div>

      {/* What you'll get */}
      <div className="border border-white/10 rounded-xl p-5 space-y-4">
        <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">What gets created for you</p>
        <div className="grid gap-3">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 text-lg">🔒</span>
            <div>
              <p className="text-sm font-medium text-white">Private GitHub repository</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                A brand-new private repo under your GitHub account, pre-loaded with the
                Next.js + Supabase template. Only you can see it.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 text-lg">▲</span>
            <div>
              <p className="text-sm font-medium text-white">Live Vercel deployment</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Your project is instantly deployed to Vercel&apos;s global CDN. Every push to
                GitHub automatically triggers a new deployment — CI/CD out of the box.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 text-lg">🌐</span>
            <div>
              <p className="text-sm font-medium text-white">Public preview URL</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                A real <code className="text-green-400 text-xs bg-white/5 px-1 rounded">*.vercel.app</code> URL
                ready to share with clients or testers — no extra DNS setup needed.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={provision} className="space-y-5">
        {/* Template */}
        <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Next.js + Supabase</p>
            <p className="text-xs text-neutral-400 mt-0.5">App Router · Tailwind v4 · Stripe ready</p>
          </div>
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Selected</span>
        </div>

        {/* Project name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-neutral-300">Project name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder="my-awesome-app"
            pattern="[a-z0-9-]{3,40}"
            required
            className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 font-mono"
          />
          <p className="text-xs text-neutral-600">Lowercase letters, numbers, hyphens · 3–40 chars</p>
        </div>

        {/* Supabase (optional) */}
        <details className="group">
          <summary className="text-sm text-neutral-400 cursor-pointer hover:text-white list-none flex items-center gap-2">
            <span className="text-xs">▶</span>
            Supabase credentials <span className="text-neutral-600">(optional — add later)</span>
          </summary>
          <div className="mt-3 space-y-3 pl-4 border-l border-white/10">
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400">Project URL</label>
              <input type="url" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://xxx.supabase.co"
                className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400">Anon key</label>
              <input type="password" value={supabaseAnonKey} onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhb…"
                className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 font-mono" />
            </div>
          </div>
        </details>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !name}
          className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold py-3 rounded-lg transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              {step || "Provisioning…"}
            </span>
          ) : (
            "🚀 Provision project"
          )}
        </button>
      </form>
    </main>
  );
}
