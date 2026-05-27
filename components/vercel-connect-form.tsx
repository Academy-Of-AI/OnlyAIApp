"use client";

import { useState } from "react";

export function VercelConnectForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      setError(error ?? "Invalid token — please try again.");
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          name="token"
          type="password"
          placeholder="Paste Vercel token…"
          required
          className="bg-white/5 border border-white/10 text-white placeholder-neutral-500 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-green-500 w-56"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black border border-white/20 text-white text-sm px-4 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {loading ? "Connecting…" : "▲ Connect Vercel"}
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      <p className="text-xs text-neutral-500">
        Don&apos;t have Vercel?{" "}
        <a
          href="https://vercel.com/signup"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-300 hover:text-white underline underline-offset-2"
        >
          Sign up free →
        </a>
        {" · "}
        Get your token{" "}
        <a
          href="https://vercel.com/account/tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-300 hover:text-white underline underline-offset-2"
        >
          here →
        </a>
        {" · "}
        <span className="text-neutral-600">
          Needs <code className="text-neutral-400">Full Account</code> scope
        </span>
      </p>
    </div>
  );
}
