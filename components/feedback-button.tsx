"use client";

import { useState } from "react";

const CATS = [
  { key: "bug", label: "Something broke" },
  { key: "confusing", label: "This is confusing" },
  { key: "idea", label: "I have an idea" },
  { key: "other", label: "Other" },
];

/**
 * Floating in-app feedback / bug submitter. Renameable via `label`. Posts to
 * /api/feedback with the current page as context so reports are actionable —
 * and so real pain can become new Pilot checks.
 */
export function FeedbackButton({ label = "Report a problem" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("bug");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!msg.trim() || sending) return;
    setSending(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: cat,
          message: msg.trim(),
          context: { url: typeof window !== "undefined" ? window.location.pathname : "" },
        }),
      });
      setDone(true);
      setMsg("");
    } catch {
      /* swallow — non-critical */
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setDone(false); }}
        className="fixed bottom-4 right-4 z-40 text-xs px-3 py-2 rounded-full bg-surface border border-outline-variant text-on-surface-variant hover:text-on-surface hover:border-outline shadow-sm"
        aria-label={label}
      >💬 {label}</button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="panel p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-2xl">🙏</p>
                <p className="text-sm font-medium text-on-surface">Thank you — we got it.</p>
                <p className="text-xs text-on-surface-variant">Every report makes Pilot smarter at catching this for everyone.</p>
                <button onClick={() => setOpen(false)} className="btn-brand text-sm px-4 py-2 mt-1">Close</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-on-surface">Tell us what happened</p>
                  <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface text-xl leading-none" aria-label="Close">×</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CATS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setCat(c.key)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        cat === c.key ? "bg-brand text-white border-brand" : "border-outline-variant text-on-surface-variant hover:text-on-surface"
                      }`}
                    >{c.label}</button>
                  ))}
                </div>
                <textarea
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  rows={4}
                  placeholder="What were you doing, and what went wrong?"
                  className="w-full rounded-lg border border-outline-variant bg-surface-dim p-2.5 text-sm text-on-surface resize-none focus:outline-none focus:border-outline"
                />
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="btn-ghost text-sm px-3 py-1.5">Cancel</button>
                  <button onClick={submit} disabled={sending || !msg.trim()} className="btn-brand text-sm px-4 py-1.5 disabled:opacity-60">
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
