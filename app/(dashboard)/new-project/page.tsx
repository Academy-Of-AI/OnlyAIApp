"use client";
import Link from "next/link";
import { useState } from "react";

// Client-safe template list (owner/repo resolved server-side from the registry)
const TEMPLATES = [
  {
    id: "vibe-stack-supabase",
    name: "Vibe Stack (Supabase)",
    description: "Next.js · App Router · Tailwind · Supabase auth/db · Stripe-ready",
    tags: ["Next.js", "Supabase", "Stripe"],
    recommended: true,
  },
];

type StepEvent = { step: string; message: string; detail?: string };
type ProvisionResult = {
  id: string;
  githubRepoUrl: string;
  vercelPreviewUrl: string;
  supabaseProjectRef?: string;
};

export default function NewProjectPage() {
  const [name, setName] = useState("");
  const [templateId] = useState(TEMPLATES[0].id); // single fixed stack
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [error, setError] = useState("");

  async function provision(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSteps([]);
    setResult(null);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, templateId }),
    });

    if (!response.body) {
      setError("No response stream");
      setLoading(false);
      return;
    }

    // Non-streaming error (auth failures, validation errors, etc.)
    if (!response.ok && response.headers.get("Content-Type")?.includes("application/json")) {
      const { error: msg } = await response.json() as { error?: string };
      setError(msg ?? "Provisioning failed");
      setLoading(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split("\n").filter((l) => l.startsWith("data: "));
      for (const line of lines) {
        try {
          const event = JSON.parse(line.slice(6)) as
            | { step: "done"; result: ProvisionResult }
            | { step: "error"; message: string }
            | StepEvent;

          if (event.step === "done") {
            const res = (event as { step: "done"; result: ProvisionResult }).result;
            setResult(res);
            setLoading(false);
            // If we came from "Start here" (Scope), seed the Plan with the brief.
            try {
              const brief = sessionStorage.getItem("scopeBrief");
              if (brief && res.id) {
                sessionStorage.removeItem("scopeBrief");
                fetch(`/api/projects/${res.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ build_prompt: brief }),
                }).catch(() => {});
              }
            } catch { /* ignore */ }
          } else if (event.step === "error") {
            setError((event as { step: "error"; message: string }).message);
            setLoading(false);
          } else {
            setSteps((prev) => {
              const last = prev[prev.length - 1];
              if (last?.step === event.step) return [...prev.slice(0, -1), event as StepEvent];
              return [...prev, event as StepEvent];
            });
          }
        } catch {
          // parse error, skip
        }
      }
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8">
      <div>
        <Link href="/dashboard" className="text-neutral-500 text-sm hover:text-white">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-2">New project</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Fill in a name below and we&apos;ll handle the rest — automatically, in about 60–120 seconds.
        </p>
      </div>

      {/* What you'll get */}
      {!result && (
        <div className="border border-white/10 rounded-xl p-5 space-y-4">
          <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
            What gets created for you
          </p>
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">🔒</span>
              <div>
                <p className="text-sm font-medium text-white">Private GitHub repository</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  A brand-new private repo under your GitHub account, pre-loaded with the Next.js +
                  Supabase template. Only you can see it.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">⚡</span>
              <div>
                <p className="text-sm font-medium text-white">Supabase database</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  A dedicated Supabase project with auth, tables, and storage — connection strings
                  injected automatically. No copy-pasting.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">▲</span>
              <div>
                <p className="text-sm font-medium text-white">Live Vercel deployment</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Your project is instantly deployed to Vercel&apos;s global CDN. Every push to GitHub
                  automatically triggers a new deployment — CI/CD out of the box.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">🌐</span>
              <div>
                <p className="text-sm font-medium text-white">Public preview URL</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  A real{" "}
                  <code className="text-green-400 text-xs bg-white/5 px-1 rounded">*.vercel.app</code>{" "}
                  URL ready to share with clients or testers — no extra DNS setup needed.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">✉️</span>
              <div>
                <p className="text-sm font-medium text-white">Email (Resend) <span className="text-xs text-neutral-500 font-normal">· add when you need it</span></p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Send signup confirmations &amp; transactional email. Connect Resend and the key is injected for you — no copy-pasting.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">💳</span>
              <div>
                <p className="text-sm font-medium text-white">Payments (Stripe) <span className="text-xs text-neutral-500 font-normal">· add when you charge</span></p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Take payments from your users when you&apos;re ready. The template is Stripe-ready — connect Stripe to start charging.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scaffolded to the OS-as-SaaS doctrine */}
      {!result && (
        <div className="border border-white/10 rounded-xl p-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
            Scaffolded the reliable way (by default)
          </p>
          <div className="space-y-2.5">
            <div className="border-l-2 border-cyan-400/70 pl-3">
              <p className="text-sm font-medium text-white">🗄 Database first</p>
              <p className="text-xs text-neutral-400 mt-0.5">A real data model is laid before any behavior.</p>
            </div>
            <div className="border-l-2 border-green-400/70 pl-3">
              <p className="text-sm font-medium text-white">⚙️ Coded logic second</p>
              <p className="text-xs text-neutral-400 mt-0.5">Business rules in real, debuggable code — not trapped in prompts.</p>
            </div>
            <div className="border-l-2 border-amber-400/70 pl-3">
              <p className="text-sm font-medium text-white">✨ Intelligence on top</p>
              <p className="text-xs text-neutral-400 mt-0.5">The agent uses the database as truth — and the core runs without it.</p>
            </div>
          </div>
          <p className="text-xs text-neutral-600">
            Your project starts <span className="text-neutral-400">reliable</span> — not blank, not agent-first.
          </p>
        </div>
      )}

      {/* Success card */}
      {result && (
        <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-bold text-lg text-white">Your project is live!</p>
              <p className="text-sm text-neutral-400">Set up automatically. Now just describe what you want — VAB builds it for you, right here.</p>
            </div>
          </div>

          {/* Primary: build it in-app (no editor, no terminal) */}
          <Link
            href={`/projects/${result.id}`}
            className="flex items-center justify-between bg-violet-500 hover:bg-violet-400 rounded-lg px-4 py-3 transition-colors"
          >
            <div>
              <p className="text-sm font-bold text-white">✨ Build your first version</p>
              <p className="text-xs text-white/80">Type what you want — VAB builds it. No setup, no code.</p>
            </div>
            <span className="text-white text-lg">→</span>
          </Link>

          {/* Secondary: see the live site */}
          <a
            href={result.vercelPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3 hover:border-green-500/50 transition-colors group"
          >
            <div>
              <p className="text-sm font-medium text-white">🌐 Open live site</p>
              <p className="text-xs text-neutral-500">{result.vercelPreviewUrl}</p>
            </div>
            <span className="text-neutral-500 group-hover:text-white">→</span>
          </a>

          {/* Demoted: take the wheel in your own editor (graduation path) */}
          <details className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
            <summary className="text-sm font-medium text-white cursor-pointer list-none">Prefer your own editor? Take the wheel →</summary>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <code className="text-xs text-green-400 bg-black/30 px-2 py-1 rounded flex-1 truncate font-mono">
                  git clone {result.githubRepoUrl}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(`git clone ${result.githubRepoUrl}`)}
                  className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded border border-white/10 hover:border-white/30 transition-colors whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-neutral-600">
                Open the folder in Claude Code / Cursor and keep building — your <code className="text-neutral-400">CLAUDE.md</code> is pre-loaded.
              </p>
            </div>
          </details>

          <Link
            href="/dashboard"
            className="block text-center text-xs text-neutral-500 hover:text-white transition-colors"
          >
            ← Back to dashboard
          </Link>
        </div>
      )}

      {/* Provision form (hidden once result arrives) */}
      {!result && (
        <form onSubmit={provision} className="space-y-5">
          {/* One fixed stack (Next.js + Supabase) — no template choice to make.
              True 1-click: just name it and go. */}

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
              disabled={loading}
              className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-green-500 font-mono disabled:opacity-50"
            />
            <p className="text-xs text-neutral-600">Lowercase letters, numbers, hyphens · 3–40 chars</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Real-time step list */}
          {loading && (
            <div className="space-y-2 py-1">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-green-400">✓</span>
                  <span className={i === steps.length - 1 ? "text-white" : "text-neutral-500"}>
                    {s.message}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3 text-sm text-neutral-400">
                <span className="w-4 h-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin inline-block flex-shrink-0" />
                <span>Working…</span>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !name}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? "Provisioning…" : "🚀 Provision project"}
          </button>
        </form>
      )}
    </main>
  );
}
