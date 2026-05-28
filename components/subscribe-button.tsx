"use client";

import { useState } from "react";

/** Starts a Pro subscription checkout (inline pricing). */
export function SubscribeButton({ label = "Upgrade to Pro" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/subscribe", { method: "POST" });
      const { url, error } = await res.json();
      if (error) { alert(error); return; }
      window.location.href = url;
    } finally { setLoading(false); }
  }
  return (
    <button onClick={go} disabled={loading}
      className="w-full bg-violet-500 hover:bg-violet-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50">
      {loading ? "Redirecting…" : label}
    </button>
  );
}
