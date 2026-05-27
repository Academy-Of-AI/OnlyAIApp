"use client";

import { useState } from "react";

export function VercelConnectForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSteps, setShowSteps] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const token = (e.currentTarget.elements.namedItem("token") as HTMLInputElement).value;
    const res = await fetch("/api/vercel/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.href = "/dashboard?connected=vercel";
    } else {
      const { error } = await res.json();
      setError(error ?? "Invalid token — please check and try again.");
    }
  }

  return (
    <div className="space-y-3 w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          name="token"
          type="password"
          placeholder="Paste your Vercel token here…"
          required
          className="bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-green-500 flex-1 min-w-0"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black border border-white/20 text-white text-sm px-4 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Connecting…" : "▲ Connect Vercel"}
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-400 px-1">{error}</p>
      )}

      {/* Helper links */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        <span>
          No Vercel account?{" "}
          <a href="https://vercel.com/signup" target="_blank" rel="noopener noreferrer"
            className="text-neutral-300 hover:text-white underline underline-offset-2">
            Sign up free →
          </a>
        </span>
        <span>·</span>
        <button
          type="button"
          onClick={() => setShowSteps((s) => !s)}
          className="text-neutral-300 hover:text-white underline underline-offset-2 cursor-pointer"
        >
          {showSteps ? "Hide instructions ↑" : "How to get your token ↓"}
        </button>
      </div>

      {/* Step-by-step instructions */}
      {showSteps && (
        <div className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3 text-sm">
          <p className="font-semibold text-white text-xs uppercase tracking-wide">
            How to get your Vercel token — 3 steps
          </p>
          <ol className="space-y-3 text-neutral-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 text-white text-xs flex items-center justify-center font-bold">1</span>
              <span>
                Go to your Vercel account settings:{" "}
                <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer"
                  className="text-green-400 hover:underline font-mono text-xs">
                  vercel.com/account/tokens
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 text-white text-xs flex items-center justify-center font-bold">2</span>
              <span>
                Click <strong className="text-white">Create Token</strong>.
                Give it any name (e.g. <code className="text-green-400 text-xs bg-white/5 px-1 rounded">vibe-launchpad</code>).
                Set scope to <strong className="text-white">Full Account</strong>.
                Set expiry to <strong className="text-white">No Expiration</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 text-white text-xs flex items-center justify-center font-bold">3</span>
              <span>
                Copy the token that appears (starts with <code className="text-green-400 text-xs bg-white/5 px-1 rounded">vercel_</code>)
                and paste it in the box above. <strong className="text-white">Save it somewhere safe</strong> — Vercel only shows it once.
              </span>
            </li>
          </ol>
          <p className="text-xs text-neutral-600 pt-1">
            🔒 Your token is encrypted before being stored. We only use it to deploy your projects.
          </p>
        </div>
      )}
    </div>
  );
}
