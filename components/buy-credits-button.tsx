"use client";

import { useState } from "react";

/** No-subscription side door: buy a starter credit pack ($10 = 3 Plan Packs / mockups). */
export function BuyCreditsButton({ label = "Grab 3 Plan Packs for $10" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: "starter" }),
      });
      const d = await res.json().catch(() => ({} as { url?: string }));
      if (d.url) { window.location.href = d.url; return; }
      setLoading(false);
    } catch { setLoading(false); }
  }
  return (
    <button onClick={go} disabled={loading} className="text-violet-300 hover:underline disabled:opacity-50">
      {loading ? "…" : label}
    </button>
  );
}
