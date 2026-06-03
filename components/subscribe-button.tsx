"use client";

import { useState } from "react";

/** Starts a Pro subscription checkout (inline pricing). */
export function SubscribeButton({
  label = "Upgrade to Pro", interval = "month", variant = "solid",
}: {
  label?: string; interval?: "month" | "year"; variant?: "solid" | "outline";
}) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const { url, error } = await res.json();
      if (error) { alert(error); return; }
      window.location.href = url;
    } finally { setLoading(false); }
  }
  const cls = variant === "outline"
    ? "border border-violet-500/50 text-violet-200 hover:bg-violet-500/10"
    : "bg-violet-500 hover:bg-violet-400 text-white";
  return (
    <button onClick={go} disabled={loading}
      className={`w-full font-semibold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50 ${cls}`}>
      {loading ? "Redirecting…" : label}
    </button>
  );
}
