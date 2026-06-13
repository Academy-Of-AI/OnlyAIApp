"use client";

import { useState } from "react";
import { uploadFeedbackScreenshot } from "@/lib/upload-image";

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
  const [shot, setShot] = useState<{ blob: Blob; preview: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function attach(file: File | null | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setErr(null);
    setShot({ blob: file, preview: URL.createObjectURL(file) });
  }
  function onPaste(e: React.ClipboardEvent) {
    const img = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (img) { const f = img.getAsFile(); if (f) { e.preventDefault(); attach(f); } }
  }

  async function submit() {
    if (!msg.trim() || sending) return;
    setSending(true); setErr(null);

    // Best-effort screenshot → PRIVATE feedback bucket (returns a storage path,
    // not a public URL). On failure we stop and let the user retry/remove it —
    // the text isn't lost.
    let screenshotPath: string | undefined;
    if (shot) {
      try { screenshotPath = await uploadFeedbackScreenshot(shot.blob); }
      catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't attach the screenshot — remove it or try again.");
        setSending(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: cat,
          message: msg.trim(),
          context: {
            url: typeof window !== "undefined" ? window.location.pathname : "",
            ...(screenshotPath ? { screenshot_path: screenshotPath } : {}),
          },
        }),
      });
      // Only claim success on a confirmed 200 — never show "Thank you" for a
      // failed save (optimistic-state #1). On failure keep the text + screenshot
      // so the user can retry instead of hitting a silent dead-end (#7).
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(data.error ?? "Couldn't send that — please try again.");
        return;
      }
      setDone(true);
      setMsg(""); setShot(null);
    } catch {
      setErr("Couldn't send that — please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setDone(false); }}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-brand text-white text-sm font-semibold shadow-lg hover:opacity-95 active:scale-[0.98] transition-all"
        aria-label={label}
      >
        <span aria-hidden="true" className="text-base">💬</span>
        <span>{label}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide bg-white/20 rounded px-1.5 py-0.5">Beta</span>
      </button>

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
                  onPaste={onPaste}
                  rows={4}
                  placeholder="What were you doing, and what went wrong?"
                  className="w-full rounded-lg border border-outline-variant bg-surface-dim p-2.5 text-sm text-on-surface resize-none focus:outline-none focus:border-outline"
                />

                {/* Screenshot — pick a file or paste (Cmd/Ctrl+V) into the box above */}
                {shot ? (
                  <div className="flex items-center gap-2 rounded-lg border border-outline-variant p-2">
                    <img src={shot.preview} alt="screenshot preview" className="h-12 w-12 rounded object-cover" />
                    <span className="text-xs text-on-surface-variant flex-1 truncate">Screenshot attached</span>
                    <button onClick={() => setShot(null)} className="text-xs text-on-surface-variant hover:text-on-surface" aria-label="Remove screenshot">Remove</button>
                  </div>
                ) : (
                  <label className="inline-flex w-fit items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface cursor-pointer">
                    <span aria-hidden>📎</span> Attach a screenshot <span className="text-outline">(or paste it above)</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                      onChange={(e) => attach(e.target.files?.[0])} />
                  </label>
                )}

                {err && <p className="text-xs text-danger">{err}</p>}

                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="btn-ghost text-sm px-3 py-1.5">Cancel</button>
                  <button onClick={submit} disabled={sending || !msg.trim()} className="btn-brand text-sm px-4 py-1.5 disabled:opacity-60">
                    {sending ? (shot ? "Uploading…" : "Sending…") : "Send"}
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
