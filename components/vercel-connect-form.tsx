"use client";

import { useState } from "react";

export function VercelConnectForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
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
      window.location.href = `${redirectTo}?connected=vercel`;
    } else {
      const { error } = await res.json();
      setError(error ?? "Invalid token — please check and try again.");
    }
  }

  return (
    <div className="space-y-3 w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          name="token"
          type="password"
          placeholder="Paste your Vercel token here…"
          required
          className="cap-input min-w-0"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-ghost w-full text-sm px-4 py-2 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Connecting…" : "▲ Connect Vercel"}
        </button>
      </form>

      {error && (
        <p className="text-xs text-danger px-1">{error}</p>
      )}

      {/* Helper links */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-on-surface-variant">
        <span>
          No Vercel account?{" "}
          <a href="https://vercel.com/signup" target="_blank" rel="noopener noreferrer"
            className="text-on-surface-variant hover:text-on-surface underline underline-offset-2">
            Sign up free →
          </a>
        </span>
        <span>·</span>
        <button
          type="button"
          onClick={() => setShowSteps((s) => !s)}
          className="text-on-surface-variant hover:text-on-surface underline underline-offset-2 cursor-pointer"
        >
          {showSteps ? "Hide instructions ↑" : "How to get your token ↓"}
        </button>
      </div>

      {/* Step-by-step instructions */}
      {showSteps && (
        <div className="bg-surface border border-outline-variant rounded-xl p-4 space-y-3 text-sm">
          <p className="font-semibold text-on-surface text-xs uppercase tracking-wide">
            How to get your Vercel token — 3 steps
          </p>
          <ol className="space-y-3 text-on-surface-variant">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-high text-on-surface text-xs flex items-center justify-center font-bold">1</span>
              <span>
                Go to your Vercel account settings:{" "}
                <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer"
                  className="text-brand hover:underline font-mono text-xs">
                  vercel.com/account/tokens
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-high text-on-surface text-xs flex items-center justify-center font-bold">2</span>
              <span>
                Click <strong className="text-on-surface">Create Token</strong>.
                Give it any name (e.g. <code className="mono mono-on text-xs">vibe-launchpad</code>).
                Set scope to <strong className="text-on-surface">Full Account</strong>.
                Set expiry to <strong className="text-on-surface">No Expiration</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-high text-on-surface text-xs flex items-center justify-center font-bold">3</span>
              <span>
                Copy the token that appears (starts with <code className="mono mono-on text-xs">vercel_</code>)
                and paste it in the box above. <strong className="text-on-surface">Save it somewhere safe</strong> — Vercel only shows it once.
              </span>
            </li>
          </ol>
          <p className="text-xs text-outline pt-1">
            🔒 Your token is encrypted before being stored. We only use it to deploy your projects.
          </p>
        </div>
      )}
    </div>
  );
}
