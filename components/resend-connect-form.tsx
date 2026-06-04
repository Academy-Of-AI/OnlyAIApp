"use client";

import { useState } from "react";

export function ResendConnectForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSteps, setShowSteps] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/resend/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    setLoading(false);

    if (res.ok) {
      window.location.href = `${redirectTo}?connected=resend`;
    } else {
      const data = await res.json() as { error?: string };
      setError(data.error ?? "Invalid API key — please check and try again.");
    }
  }

  return (
    <div className="space-y-3 w-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your Resend API key…"
          required
          className="w-full bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500 min-w-0"
        />
        <button
          type="submit"
          disabled={loading || !token}
          className="w-full bg-black border border-white/20 text-white text-sm px-4 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Connecting…" : "✉ Connect Resend"}
        </button>
      </form>

      {error && <p className="text-xs text-red-400 px-1">{error}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        <span>
          No account?{" "}
          <a href="https://resend.com/signup" target="_blank" rel="noopener noreferrer"
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
          {showSteps ? "Hide instructions ↑" : "How to get your key ↓"}
        </button>
      </div>

      {showSteps && (
        <div className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3 text-sm">
          <p className="font-semibold text-white text-xs uppercase tracking-wide">
            How to get your Resend API key — 3 steps
          </p>
          <ol className="space-y-3 text-neutral-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 text-white text-xs flex items-center justify-center font-bold">1</span>
              <span>
                Go to your Resend API keys page:{" "}
                <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer"
                  className="text-green-400 hover:underline font-mono text-xs">
                  resend.com/api-keys
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 text-white text-xs flex items-center justify-center font-bold">2</span>
              <span>
                Click <strong className="text-white">Create API Key</strong>.
                Name it{" "}
                <code className="text-green-400 text-xs bg-white/5 px-1 rounded">vibe-launchpad</code>.
                Set permission to <strong className="text-white">Full Access</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 text-white text-xs flex items-center justify-center font-bold">3</span>
              <span>
                Copy the key (starts with{" "}
                <code className="text-green-400 text-xs bg-white/5 px-1 rounded">re_</code>)
                and paste it above. <strong className="text-white">Save it somewhere safe</strong> — Resend only shows it once.
              </span>
            </li>
          </ol>
          <p className="text-xs text-neutral-600 pt-1">
            🔒 Your key is encrypted before being stored. We only use it to enable email in your provisioned projects.
          </p>
        </div>
      )}
    </div>
  );
}
