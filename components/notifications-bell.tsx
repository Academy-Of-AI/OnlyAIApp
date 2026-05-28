"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Notif { id: string; type: string; title: string; body: string | null; read: boolean; created_at: string; project_id: string | null }

const ICON: Record<string, string> = { drift: "⟲", milestone: "✓", deploy: "▲", info: "•" };

export function NotificationsBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setItems((await res.json()).notifications ?? []);
    } catch { /* ignore */ }
  }
  useEffect(() => { load(); }, []);

  const unread = items.filter((i) => !i.read).length;

  async function markAll() {
    setItems((p) => p.map((i) => ({ ...i, read: true })));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
  }

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); if (!open && unread) markAll(); }}
        className="relative border border-white/10 hover:border-white/25 rounded-lg w-9 h-9 grid place-items-center text-neutral-300 transition-colors">
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-violet-500 text-white text-[10px] font-bold rounded-full w-4 h-4 grid place-items-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-neutral-900 border border-white/15 rounded-xl shadow-xl z-50">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-500 px-4 py-6 text-center">No notifications yet.</p>
          ) : (
            items.map((n) => (
              <Link key={n.id} href={n.project_id ? `/projects/${n.project_id}` : "/dashboard"}
                className="block px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                <div className="text-sm font-medium flex items-center gap-2">
                  <span>{ICON[n.type] ?? "•"}</span>{n.title}
                </div>
                {n.body && <p className="text-xs text-neutral-500 mt-0.5">{n.body}</p>}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
