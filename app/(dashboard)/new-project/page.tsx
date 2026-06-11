"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  vercelPreviewUrl?: string; // absent on the GitHub-only path (no Vercel deploy)
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
  // The deploy is only TRIGGERED at provision time, not live yet — poll the real
  // Vercel state so we never hand out a *.vercel.app link that 404s.
  const [deployState, setDeployState] = useState<"building" | "ready" | "error" | "slow" | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  useEffect(() => {
    // Only poll when a Vercel deploy is actually in flight (the GitHub-only path
    // has no vercelPreviewUrl, so there's nothing to wait on).
    if (!result?.id || !result.vercelPreviewUrl) return;
    let cancelled = false;
    let tries = 0;
    setDeployState("building");
    const poll = async () => {
      try {
        const r = await fetch(`/api/projects/${result.id}/deploy-status`, { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as { state: string; url?: string };
          if (cancelled) return;
          if (j.state === "ready") { setLiveUrl(j.url ?? result.vercelPreviewUrl ?? null); setDeployState("ready"); return; }
          if (j.state === "error") { setDeployState("error"); return; }
        }
      } catch { /* transient — keep polling */ }
      tries += 1;
      // ~4 min ceiling. Past that, stop spinning forever and tell the truth:
      // it's taking longer than usual — it'll appear on the project page when live.
      if (!cancelled && tries < 48) setTimeout(poll, 5000);
      else if (!cancelled) setDeployState("slow");
    };
    void poll();
    return () => { cancelled = true; };
  }, [result]);

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

    // Track whether we saw a terminal event ("done" or "error"). If the stream
    // drops or ends without one, the finally block still clears loading so the
    // button can never hang on "Provisioning…" forever.
    let sawTerminal = false;

    try {
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
              sawTerminal = true;
              const res = (event as { step: "done"; result: ProvisionResult }).result;
              setResult(res);
              // If we came from "Start here" (Scope), seed the Plan with the brief.
              try {
                const brief = sessionStorage.getItem("scopeBrief");
                const track = sessionStorage.getItem("scopeTrack");
                if ((brief || track) && res.id) {
                  sessionStorage.removeItem("scopeBrief");
                  sessionStorage.removeItem("scopeTrack");
                  const patch: Record<string, string> = {};
                  if (brief) patch.build_prompt = brief;
                  if (track) patch.track = track;
                  fetch(`/api/projects/${res.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(patch),
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
              sawTerminal = true;
              setError((event as { step: "error"; message: string }).message);
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
    } catch {
      // Stream dropped/aborted mid-provision. Don't leave the user stuck — surface
      // a recoverable message unless a terminal event already arrived. The repo
      // (and any Supabase/Vercel resources) may still have been created server-side.
      if (!sawTerminal) {
        setError("The connection dropped while setting up your project. Check your dashboard in a minute — it may have finished — or try again.");
      }
    } finally {
      // ALWAYS clear loading, even if the stream ended without a terminal event
      // (e.g. proxy timeout). This is the guard that prevents a permanent
      // "Provisioning…" hang.
      setLoading(false);
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

      {/* Project limit wall — refer for a bonus, or upgrade */}
      {!result && limitWall && (
        <div className="panel p-5 space-y-4 border-brand-border" style={{ background: "var(--color-brand-container)" }}>
          <div>
            <p className="eyebrow">Project limit</p>
            <p className="text-sm text-on-surface mt-1">{limitWall}</p>
          </div>
          <p className="text-xs text-on-surface-variant">
            🎁 Refer a friend — when they ship their first app, you both get a bonus project. Or upgrade for up to 8 projects + delete/recreate.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Link href="/invite" className="btn-ghost text-sm px-4 py-2">🎁 Get your invite link</Link>
            <Link href="/upgrade" className="btn-brand text-sm px-4 py-2">Upgrade to Core ($8/mo) →</Link>
          </div>
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
                <p className="text-sm font-medium text-on-surface">Live hosting on Vercel <span className="text-xs text-outline font-normal">· connect Vercel to go live</span></p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Connect Vercel (free) and we deploy your app to a live URL — every push to GitHub
                  auto-redeploys. CI/CD out of the box.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 text-lg">🌐</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Public preview URL</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Once it&apos;s deployed, you get a real{" "}
                  <code className="mono">*.vercel.app</code>{" "}
                  URL to share with clients or testers — no extra DNS setup.
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

      {/* Why it's built to last (high-level differentiation — no method details) */}
      {!result && (
        <div className="panel p-5 space-y-3">
          <p className="eyebrow">Built to last, by default</p>
          <div className="space-y-2.5">
            <div className="border-l-2 border-brand-border pl-3">
              <p className="text-sm font-medium text-on-surface">🧱 A solid foundation, not a fragile demo</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Set up the proven way, so it stays reliable as it grows.</p>
            </div>
            <div className="border-l-2 border-brand-border pl-3">
              <p className="text-sm font-medium text-on-surface">🔌 Keeps working even if the AI is off</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Real, dependable software — not magic that breaks when a prompt changes.</p>
            </div>
            <div className="border-l-2 border-brand-border pl-3">
              <p className="text-sm font-medium text-on-surface">🔑 Yours to own &amp; grow</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Real code in your own accounts — never locked in.</p>
            </div>
          </div>
          <p className="text-xs text-outline">
            Your project starts <span className="text-on-surface-variant">reliable</span> — not a flimsy throwaway.
          </p>
        </div>
      )}

      {/* Success card */}
      {result && (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {!result.vercelPreviewUrl ? "📦" : deployState === "ready" ? "🎉" : deployState === "error" ? "⚠️" : deployState === "slow" ? "🕐" : "🚀"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="dot" style={{ background:
                  !result.vercelPreviewUrl ? "var(--color-outline)"
                  : deployState === "ready" ? "var(--color-success)"
                  : deployState === "error" ? "#dc2626"
                  : "#f59e0b" }} />
                <p className="font-bold text-lg text-on-surface font-display tracking-tight">
                  {!result.vercelPreviewUrl ? "Repo created"
                    : deployState === "ready" ? "Your project is live!"
                    : deployState === "error" ? "Deploy hit a snag"
                    : deployState === "slow" ? "Still deploying…"
                    : "Deploying your app…"}
                </p>
              </div>
              <p className="text-sm text-on-surface-variant">
                {!result.vercelPreviewUrl
                  ? "Your GitHub repo is ready. Connect Vercel to deploy it to a live URL."
                  : deployState === "ready"
                    ? "Set up automatically and now live on Vercel. Open it and start building."
                    : deployState === "error"
                      ? "The first build didn’t finish. Open your project to see what happened and redeploy."
                      : deployState === "slow"
                        ? "This is taking longer than usual. You don’t need to wait here — the live link will appear on your project page as soon as it’s up."
                        : "Repo + database are ready and the first deploy is building on Vercel (~1–2 min). The live link appears here the moment it’s up."}
              </p>
            </div>
          </div>

          {/* Primary: open the project workspace */}
          <Link
            href={`/projects/${result.id}`}
            className="btn-brand flex items-center justify-between px-4 py-3"
          >
            <div>
              <p className="text-sm font-bold text-white">✨ Open your project</p>
              <p className="text-xs text-white/80">Plan it, build it, and ship it — all in one place.</p>
            </div>
            <span className="text-white text-lg">→</span>
          </Link>

          {/* Secondary: the live site — shown ONLY once the deploy is verified
              READY (the link 404s while the build is still running). */}
          {!result.vercelPreviewUrl ? (
            <div className="flex items-center justify-between bg-surface-low border border-outline-variant rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-on-surface">▲ Connect Vercel to deploy</p>
                <p className="text-xs text-on-surface-variant">No live URL yet — link Vercel and every push deploys automatically.</p>
              </div>
            </div>
          ) : deployState === "ready" ? (
            <a
              href={liveUrl ?? result.vercelPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-surface-low border border-outline-variant rounded-lg px-4 py-3 hover:border-outline transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-on-surface">🌐 Open live site</p>
                <p className="text-xs text-on-surface-variant">{liveUrl ?? result.vercelPreviewUrl}</p>
              </div>
              <span className="text-outline group-hover:text-on-surface">→</span>
            </a>
          ) : deployState === "error" ? (
            <div className="bg-surface-low border-l-2 border-l-danger border border-outline-variant rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-on-surface">⚠️ The first deploy didn’t finish</p>
              <p className="text-xs text-on-surface-variant">Open your project to see the build error and redeploy.</p>
            </div>
          ) : deployState === "slow" ? (
            <div className="bg-surface-low border-l-2 border-l-[#f59e0b] border border-outline-variant rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-on-surface">🕐 Still building on Vercel</p>
              <p className="text-xs text-on-surface-variant">It’s taking longer than usual. Your project page shows the live link as soon as it’s up — no need to wait here.</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-surface-low border border-outline-variant rounded-lg px-4 py-3">
              <span className="w-4 h-4 border-2 border-outline-variant border-t-brand rounded-full animate-spin inline-block shrink-0" />
              <div>
                <p className="text-sm font-medium text-on-surface">Deploying to Vercel…</p>
                <p className="text-xs text-on-surface-variant">Usually ~1–2 minutes. The live link appears here automatically — no need to refresh.</p>
              </div>
            </div>
          )}

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
              pattern="[a-z0-9\-]{3,40}"
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
