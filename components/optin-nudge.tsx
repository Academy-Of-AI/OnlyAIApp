"use client";

import { useState } from "react";
import { OptInForm } from "@/components/optin-form";

/** Dashboard nudge for free users: opt in to product updates (WhatsApp + short intro). */
export function OptInNudge() {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel p-4 sm:p-5 border-brand-border" style={{ background: "var(--color-brand-container)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface">Stay in the loop</p>
          <p className="text-xs text-on-surface-variant">Drop your WhatsApp + a 30-second intro — we&apos;ll send new features &amp; build tips. Unsubscribe anytime.</p>
        </div>
        {!open && <button onClick={() => setOpen(true)} className="btn-brand text-sm px-4 py-2 shrink-0">Keep me posted →</button>}
      </div>
      {open && <div className="mt-4"><OptInForm cta="Keep me posted" onDone={() => setOpen(false)} /></div>}
    </div>
  );
}
