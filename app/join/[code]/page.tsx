"use client";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = ((params.code as string) ?? "").toUpperCase();
  // Where auth should return the user to so the join intent survives sign-in.
  const joinPath = `/join/${code}`;

  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ githubRepoUrl: string; vercelPreviewUrl: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { email: data.user.email! } : null);
      setLoading(false);
    });
  }, []);

  async function join() {
    setJoining(true);
    setError("");

    const steps = [
      "Claiming your spot…",
      "Forking template repo…",
      "Setting up Vercel project…",
      "Injecting config…",
    ];
    let i = 0;
    const interval = setInterval(() => {
      setStep(steps[Math.min(i++, steps.length - 1)]);
    }, 1800);

    try {
      const res = await fetch("/api/hackathons/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });
      clearInterval(interval);

      const data = await res.json();

      if (data.alreadyJoined) {
        setDone({
          githubRepoUrl: data.project.github_repo_url,
          vercelPreviewUrl: data.project.vercel_preview_url,
        });
        return;
      }

      if (!res.ok) {
        if (data.needsConnect) {
          router.push(`/dashboard?joinCode=${code}&needsConnect=1`);
          return;
        }
        setError(data.error ?? "Something went wrong");
        setJoining(false);
        return;
      }

      setDone({ githubRepoUrl: data.githubRepoUrl, vercelPreviewUrl: data.vercelPreviewUrl });
    } catch {
      clearInterval(interval);
      setError("Network error. Please try again.");
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-outline-variant border-t-brand rounded-full animate-spin" />
      </main>
    );
  }

  if (done) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="text-5xl">🚀</div>
          <h1 className="text-2xl font-bold text-on-surface font-display tracking-tight">You&apos;re in!</h1>
          <p className="text-on-surface-variant text-sm">Your project is live and ready to hack on.</p>
          <div className="flex flex-col gap-3">
            <a href={done.vercelPreviewUrl} target="_blank" rel="noopener noreferrer"
              className="btn-brand text-white py-3 transition-colors text-sm">
              Open live URL →
            </a>
            <a href={done.githubRepoUrl} target="_blank" rel="noopener noreferrer"
              className="btn-ghost py-3 transition-colors text-sm">
              Open GitHub repo
            </a>
            <a href="/dashboard" className="text-outline hover:text-on-surface text-xs transition-colors">
              Go to dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-2">
          <span className="mono">
            INVITE CODE: {code}
          </span>
          <h1 className="text-2xl font-bold text-on-surface mt-3 font-display tracking-tight">Join the hackathon</h1>
          <p className="text-on-surface-variant text-sm">
            Get a full-stack app provisioned under your GitHub + Vercel in ~60 seconds.
          </p>
        </div>

        {!user ? (
          <div className="space-y-3">
            <p className="text-outline text-sm text-center">Sign in or create an account to continue</p>
            <a
              href={`/sign-up?next=${encodeURIComponent(joinPath)}`}
              className="btn-brand block w-full text-center text-white py-3 transition-colors"
            >
              Create free account →
            </a>
            <a
              href={`/sign-in?next=${encodeURIComponent(joinPath)}`}
              className="btn-ghost block w-full text-center py-3 transition-colors text-sm"
            >
              Sign in
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="panel px-4 py-3 text-sm text-on-surface-variant">
              Signed in as <span className="text-on-surface">{user.email}</span>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-danger text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              onClick={join}
              disabled={joining}
              className="btn-brand w-full text-white py-3 transition-colors"
            >
              {joining ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {step || "Provisioning…"}
                </span>
              ) : (
                "🚀 Join & provision my environment"
              )}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
