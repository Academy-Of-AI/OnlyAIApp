"use client";
import Link from "next/link";
import { useState } from "react";
import { OptInForm } from "@/components/optin-form";

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
  commitEmail?: string;
  commitName?: string;
};

export default function NewProjectPage() {
  const [name, setName] = useState("");
  const [templateId] = useState(TEMPLATES[0].id); // single fixed stack
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [error, setError] = useState("");
  const [limitWall, setLimitWall] = useState<string | null>(null);

  // The clone command bakes in the git identity (when known) so Claude Code's
  // first local commit is authored by an email on the user's GitHub account —
  // otherwise Vercel blocks the deploy ("commit email could not be matched").
  const repoDir = result?.githubRepoUrl
    ? (result.githubRepoUrl.replace(/\.git$/, "").split("/").pop() || "app")
    : "app";
  const cloneCmd = result
    ? (result.commitEmail && result.commitName
        ? `git clone ${result.githubRepoUrl} && cd ${repoDir} && git config user.email "${result.commitEmail}" && git config user.name "${result.commitName}"`
        : `git clone ${result.githubRepoUrl}`)
    : "";

  async function provision(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setLimitWall(null);
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

    // Non-streaming error (auth failures, validation errors, plan limits, etc.)
    if (!response.ok && response.headers.get("Content-Type")?.includes("application/json")) {
      const j = await response.json() as { error?: string; code?: string };
      if (j.code === "plan_limit") setLimitWall(j.error ?? "You've reached your project limit.");
      else setError(j.error ?? "Provisioning failed");
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
              // Carry any uploaded docs (Start here → Upload) to THIS project so
              // the Plan Pack can pick them up and generate in the chosen mode.
              const upload = sessionStorage.getItem("scopeUpload");
              if (upload && res.id) {
                sessionStorage.setItem(`scopeUpload:${res.id}`, upload);
                sessionStorage.removeItem("scopeUpload");
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
        <Link href="/dashboard" className="text-on-surface-variant text-sm hover:text-on-surface">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-2 font-display tracking-tight text-on-surface">New project</h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Fill in a name below and we&apos;ll handle the rest — automatically, in about 60–120 seconds.
        </p>
      </div>

      {/* Project limit wall — data opt-in (free +1) or upgrade */}
      {!result && limitWall && (
        <div className="panel p-5 space-y-4 border-brand-border" style={{ background: "var(--color-brand-container)" }}>
          <div>
            <p className="eyebrow">Project limit</p>
            <p className="text-sm text-on-surface mt-1">{limitWall}</p>
          </div>
          <OptInForm cta="Unlock my 2nd free project" onDone={() => setLimitWall(null)} />
          <p className="text-xs text-on-surface-variant">
            Want up to 8 projects and the ability to delete &amp; recreate?{" "}
            <Link href="/upgrade" className="text-brand hover:underline">Upgrade to Core ($8/mo)</Link>.
          </p>
        </div>
      )}

      {/* What you'll get */}
      {!result && !limitWall && (
        <div className="panel p-5 space-y-4">
          <p className="eyebrow">
            What gets created for you
          </p>
          <div className="grid gap-3">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">🔒</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Private GitHub repository</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  A brand-new private repo under your GitHub account, pre-loaded with the Next.js +
                  Supabase template. Only you can see it.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">⚡</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Supabase database</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  A dedicated Supabase project with auth, tables, and storage — connection strings
                  injected automatically. No copy-pasting.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">▲</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Live Vercel deployment</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Your project is instantly deployed to Vercel&apos;s global CDN. Every push to GitHub
                  automatically triggers a new deployment — CI/CD out of the box.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">🌐</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Public preview URL</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  A real{" "}
                  <code className="mono">*.vercel.app</code>{" "}
                  URL ready to share with clients or testers — no extra DNS setup needed.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">✉️</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Email (Resend) <span className="text-xs text-outline font-normal">· add when you need it</span></p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Send signup confirmations &amp; transactional email. Connect Resend and the key is injected for you — no copy-pasting.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">💳</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Payments (Stripe) <span className="text-xs text-outline font-normal">· add when you charge</span></p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Take payments from your users when you&apos;re ready. The template is Stripe-ready — connect Stripe to start charging.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scaffolded to the OS-as-SaaS doctrine */}
      {!result && (
        <div className="panel p-5 space-y-3">
          <p className="eyebrow">
            Scaffolded the reliable way (by default)
          </p>
          <div className="space-y-2.5">
            <div className="border-l-2 border-info pl-3">
              <p className="text-sm font-medium text-on-surface">🗄 Database first</p>
              <p className="text-xs text-on-surface-variant mt-0.5">A real data model is laid before any behavior.</p>
            </div>
            <div className="border-l-2 border-success pl-3">
              <p className="text-sm font-medium text-on-surface">⚙️ Coded logic second</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Business rules in real, debuggable code — not trapped in prompts.</p>
            </div>
            <div className="border-l-2 border-warn pl-3">
              <p className="text-sm font-medium text-on-surface">✨ Intelligence on top</p>
              <p className="text-xs text-on-surface-variant mt-0.5">The agent uses the database as truth — and the core runs without it.</p>
            </div>
          </div>
          <p className="text-xs text-outline">
            Your project starts <span className="text-on-surface-variant">reliable</span> — not blank, not agent-first.
          </p>
        </div>
      )}

      {/* Success card */}
      {result && (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="dot bg-success" />
                <p className="font-bold text-lg text-on-surface font-display tracking-tight">Your project is live!</p>
              </div>
              <p className="text-sm text-on-surface-variant">Set up automatically. Now just describe what you want — VAB builds it for you, right here.</p>
            </div>
          </div>

          {/* Primary: build it in-app (no editor, no terminal) */}
          <Link
            href={`/projects/${result.id}`}
            className="btn-brand flex items-center justify-between px-4 py-3"
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
            className="flex items-center justify-between bg-surface-low border border-outline-variant rounded-lg px-4 py-3 hover:border-outline transition-colors group"
          >
            <div>
              <p className="text-sm font-medium text-on-surface">🌐 Open live site</p>
              <p className="text-xs text-on-surface-variant">{result.vercelPreviewUrl}</p>
            </div>
            <span className="text-outline group-hover:text-on-surface">→</span>
          </a>

          {/* Demoted: take the wheel in your own editor (graduation path) */}
          <details className="bg-surface-low border border-outline-variant rounded-lg px-4 py-3">
            <summary className="text-sm font-medium text-on-surface cursor-pointer list-none">Prefer your own editor? Take the wheel →</summary>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2">
                <code className="text-xs text-on-surface bg-surface px-2 py-1 rounded flex-1 font-mono whitespace-pre-wrap break-all leading-relaxed border border-outline-variant">
                  {cloneCmd}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(cloneCmd)}
                  className="btn-ghost text-xs px-2 py-1 whitespace-nowrap shrink-0"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-outline">
                Open the folder in Claude Code / Cursor and keep building — your <code className="text-on-surface-variant">CLAUDE.md</code> is pre-loaded.
                {result.commitEmail && " The git identity is set so Vercel won't block your deploys."}
              </p>
            </div>
          </details>

          <Link
            href="/dashboard"
            className="block text-center text-xs text-on-surface-variant hover:text-on-surface transition-colors"
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
            <label className="text-sm font-medium text-on-surface-variant">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="my-awesome-app"
              pattern="[a-z0-9-]{3,40}"
              required
              disabled={loading}
              className="cap-input font-mono disabled:opacity-50"
            />
            <p className="text-xs text-outline">Lowercase letters, numbers, hyphens · 3–40 chars</p>
          </div>

          {error && (
            <div className="panel border-l-2 border-l-danger text-danger text-sm px-4 py-3">
              {error}
            </div>
          )}

          {/* Real-time step list */}
          {loading && (
            <div className="space-y-2 py-1">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-success">✓</span>
                  <span className={i === steps.length - 1 ? "text-on-surface" : "text-on-surface-variant"}>
                    {s.message}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                <span className="w-4 h-4 border-2 border-outline-variant border-t-brand rounded-full animate-spin inline-block flex-shrink-0" />
                <span>Working…</span>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !name}
            className="btn-brand w-full py-3"
          >
            {loading ? "Provisioning…" : "🚀 Provision project"}
          </button>
        </form>
      )}
    </main>
  );
}
