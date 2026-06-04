"use client";

import { useState } from "react";
import { OptInForm } from "@/components/optin-form";

/** Dashboard nudge for free users: add WhatsApp + intro → unlock a 2nd free project. */
export function OptInNudge() {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel p-4 sm:p-5 border-brand-border" style={{ background: "var(--color-brand-container)" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface">Get a 2nd free project</p>
          <p className="text-xs text-on-surface-variant">Add your WhatsApp + a 30-second intro — we&apos;ll send build tips, you can unsubscribe anytime.</p>
        </div>
        {!open && <button onClick={() => setOpen(true)} className="btn-brand text-sm px-4 py-2 shrink-0">Add WhatsApp →</button>}
      </div>
      {open && <div className="mt-4"><OptInForm cta="Unlock my 2nd free project" onDone={() => setOpen(false)} /></div>}
    </div>
  );
}
