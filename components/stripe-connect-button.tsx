"use client";

import { useState } from "react";

export function StripeConnectButton() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connect() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = await res.json().catch(() => ({} as { url?: string; error?: string }));
      if (d.url) { window.location.href = d.url; return; }
      setErr(d.error ?? "Couldn't start Stripe.");
      setLoading(false);
    } catch {
      setErr("Couldn't start Stripe.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 w-full">
      <button
        onClick={connect}
        disabled={loading}
        className="w-full text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap font-semibold"
        style={{ backgroundColor: "#635bff" }}
      >
        {loading ? "Opening Stripe…" : "Connect Stripe"}
      </button>
      {err && <p className="text-xs text-red-400 px-1">{err}</p>}
    </div>
  );
}
