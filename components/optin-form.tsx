"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Product-updates opt-in — phone/WhatsApp + a short intro + marketing consent
 * (PDPA/GDPR). Subscribes the user to updates & tips. Used as a dashboard nudge.
 */
export function OptInForm({ onDone, cta = "Keep me posted" }: { onDone?: () => void; cta?: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [building, setBuilding] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [source, setSource] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (busy) return;
    if (!phone.trim()) { setErr("Add your phone / WhatsApp number."); return; }
    if (!consent) { setErr("Please tick the consent box to continue."); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/profile/optin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, role, building, companySize, source, consent }),
      });
      const d = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) { setErr(d.error ?? "Couldn't save."); setBusy(false); return; }
      setDone(true);
      router.refresh();
      onDone?.();
    } catch { setErr("Couldn't save."); setBusy(false); }
  }

  if (done) return <p className="text-sm text-success">✓ Thanks — you&apos;re subscribed. We&apos;ll keep you posted.</p>;

  return (
    <div className="space-y-3">
      <input className="cap-input" placeholder="Phone / WhatsApp (with country code, e.g. +65 9xxx xxxx)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <div className="grid sm:grid-cols-2 gap-3">
        <input className="cap-input" placeholder="Your role (e.g. founder, sales lead)" value={role} onChange={(e) => setRole(e.target.value)} />
        <input className="cap-input" placeholder="Company size (e.g. just me, 2–10)" value={companySize} onChange={(e) => setCompanySize(e.target.value)} />
      </div>
      <input className="cap-input" placeholder="What are you building? (one line)" value={building} onChange={(e) => setBuilding(e.target.value)} />
      <input className="cap-input" placeholder="How did you hear about us?" value={source} onChange={(e) => setSource(e.target.value)} />
      <label className="flex items-start gap-2 text-xs text-on-surface-variant">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--color-brand)]" />
        <span>It&apos;s OK to email / WhatsApp me product updates &amp; tips. I can unsubscribe anytime. See the{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Privacy Policy</a> (PDPA / GDPR).</span>
      </label>
      {err && <p className="text-xs text-danger">{err}</p>}
      <button onClick={submit} disabled={busy} className="btn-brand text-sm px-4 py-2">{busy ? "Saving…" : cta}</button>
    </div>
  );
}
