"use client";

import { useState } from "react";

/**
 * Referral loop — free-marketing growth.
 * Phase 1: presents the invite link (provisional code = github username).
 * Phase 4 wires /r/[code] attribution + the "+1 project on referee's first ship" reward.
 */
export function ReferralCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `onlyaiapp.com/r/${code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div
      id="invite"
      className="rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap scroll-mt-20"
      style={{ background: "linear-gradient(110deg,#1b1230,#2a1750)", border: "1px solid #2a1750", color: "#fff" }}
    >
      <div className="min-w-0">
        <div className="font-display font-bold text-lg">🎁 Give a build, get a build</div>
        <p className="text-[13px] mt-1 max-w-[48ch]" style={{ color: "#cdbdf0" }}>
          Invite a friend — when they ship their first app, you <b className="text-white">both</b> get a free project.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 items-start">
        <button
          onClick={copy}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-mono text-xs transition-colors"
          style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.25)", color: "#e9defc" }}
        >
          {link} <span style={{ opacity: 0.75 }}>{copied ? "✓ copied" : "📋"}</span>
        </button>
        <span className="text-[11px]" style={{ color: "#a48fd0" }}>🙌 share it anywhere</span>
      </div>
    </div>
  );
}
