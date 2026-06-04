"use client";

import { useState } from "react";

export function WallUpvote({ id, initial }: { id: string; initial: number }) {
  const [count, setCount] = useState(initial);
  const [voted, setVoted] = useState(false);

  async function up() {
    if (voted) return;
    try {
      const k = "wall_voted";
      const v: string[] = JSON.parse(localStorage.getItem(k) || "[]");
      if (v.includes(id)) { setVoted(true); return; }
      v.push(id); localStorage.setItem(k, JSON.stringify(v));
    } catch { /* ignore */ }
    setVoted(true);
    setCount((c) => c + 1);
    try { await fetch(`/api/wall/${id}/upvote`, { method: "POST" }); } catch { /* optimistic */ }
  }

  return (
    <button
      onClick={up}
      disabled={voted}
      className={`flex items-center gap-1.5 text-sm border rounded-lg px-3 py-1.5 transition-colors shrink-0 ${
        voted ? "border-brand-border bg-brand-container text-brand-dim" : "border-outline-variant hover:border-outline text-on-surface-variant"
      }`}
    >
      ▲ <span className="tabnum">{count}</span>
    </button>
  );
}
