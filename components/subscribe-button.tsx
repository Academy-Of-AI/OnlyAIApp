"use client";

import { useState } from "react";

/** Starts a Pro subscription checkout. */
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
  return (
    <button onClick={go} disabled={loading}
      className={`w-full text-sm py-2.5 disabled:opacity-50 ${variant === "outline" ? "btn-ghost" : "btn-brand"}`}>
      {loading ? "Redirecting…" : label}
    </button>
  );
}

/** Opens the Stripe customer portal to manage/cancel an existing subscription. */
export function ManageBillingButton({ label = "Manage billing →", className = "" }: { label?: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const d = await res.json().catch(() => ({} as { url?: string; error?: string }));
      if (d.url) { window.location.href = d.url; return; }
      alert(d.error ?? "No billing account found.");
    } finally { setLoading(false); }
  }
  return (
    <button onClick={go} disabled={loading} className={className || "text-brand hover:underline text-xs disabled:opacity-50"}>
      {loading ? "…" : label}
    </button>
  );
}
