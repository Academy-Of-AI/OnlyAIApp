"use client";

import { useState } from "react";

/** Buys a one-time build-credit pack. */
export function CreditButton({ pack, label }: { pack: string; label: string }) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const { url, error } = await res.json();
      if (error) { alert(error); return; }
      window.location.href = url;
    } finally { setLoading(false); }
  }
  return (
    <button onClick={go} disabled={loading}
      className="w-full border border-white/15 hover:border-white/30 text-white font-medium py-2 rounded-lg transition-colors text-sm disabled:opacity-50">
      {loading ? "Redirecting…" : label}
    </button>
  );
}
