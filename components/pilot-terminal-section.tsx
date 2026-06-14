"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/date";

type TokenRow = {
  id: string;
  name: string;
  last_four: string;
  created_at: string;
  last_used_at: string | null;
};

/**
 * Settings → "Pilot in your terminal". Its OWN section (not a 5th integration):
 * this is the user's developer access, separate from the project-provisioning
 * integrations. Pro → setup + token management; non-Pro → the upgrade CTA, so the
 * section both shows the feature and sells it (discovery + conversion in one).
 */
export function PilotTerminalSection({
  isPro, tokens, used, limit,
}: { isPro: boolean; tokens: TokenRow[]; used: number; limit: number }) {
  const router = useRouter();
  const [fresh, setFresh] = useState<string | null>(null); // plaintext, shown once
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(key: string, text: string) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
  }

  async function mint() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/pilot/tokens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "cli" }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !data.token) { setErr(data.error ?? "Couldn't create a token."); return; }
      setFresh(data.token);
      router.refresh(); // pull the new token into the list below
    } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/pilot/tokens?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  // ── Non-Pro: the feature, plus the upgrade door (discovery + conversion) ──
  if (!isPro) {
    return (
      <section className="panel p-5 space-y-3">
        <SectionHead />
        <p className="text-sm text-on-surface-variant">
          Run Pilot’s checks inside Claude Code, Codex, or any terminal — it reads your repo locally and
          flags the drift classes before they ship. Your code stays on your machine.
        </p>
        <Link href="/upgrade" className="btn-brand inline-flex items-center gap-2 text-sm px-4 py-2 w-fit">
          Upgrade to Pro to unlock →
        </Link>
      </section>
    );
  }

  const remaining = Math.max(0, limit - used);
  const Cmd = ({ k, text }: { k: string; text: string }) => (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant bg-surface-dim px-3 py-2 font-mono text-xs text-on-surface">
      <span className="truncate">{text}</span>
      <button onClick={() => copy(k, text)} className="shrink-0 text-on-surface-variant hover:text-on-surface" aria-label="Copy">
        {copied === k ? "✓" : "Copy"}
      </button>
    </div>
  );

  return (
    <section className="panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <SectionHead />
        <span className={`chip shrink-0 ${tokens.length ? "chip-success" : "chip-neutral"}`}>
          {tokens.length ? "Connected" : "Not set up"}
        </span>
      </div>

      <p className="text-sm text-on-surface-variant">
        Run Pilot’s checks inside Claude Code, Codex, or any terminal. Your code stays on your machine.
      </p>

      <div className="space-y-3">
        <Step n={1} label="Install once — optional (or use npx, no install)">
          <Cmd k="install" text="npm i -g onlyai-pilot" />
        </Step>

        <Step n={2} label="Connect your account">
          {fresh ? (
            <div className="space-y-1.5">
              <Cmd k="login" text={`pilot login ${fresh}`} />
              <p className="text-[11px] text-warn">⚠ Copy it now — this token is shown only once.</p>
            </div>
          ) : (
            <button onClick={mint} disabled={busy}
              className="btn-brand text-sm px-4 py-1.5 disabled:opacity-60">
              {busy ? "Generating…" : "Generate token"}
            </button>
          )}
        </Step>

        <Step n={3} label="Run it in any repo">
          <Cmd k="run" text="pilot check" />
          <p className="text-[11px] text-on-surface-variant">No install? Use <code className="text-on-surface">npx onlyai-pilot check</code> instead.</p>
        </Step>
      </div>

      {err && <p className="text-xs text-danger">{err}</p>}

      <div className="rounded-lg border border-outline-variant bg-surface-low px-3 py-2.5 text-xs text-on-surface-variant">
        <span className="text-on-surface font-medium">Tip — </span>
        add a line to your project’s <code className="text-on-surface">CLAUDE.md</code> / <code className="text-on-surface">AGENTS.md</code>:
        “before deploying, run <code className="text-on-surface">npx onlyai-pilot check</code>”. Your AI then runs it for you — nothing to install.
      </div>

      <div className="flex items-center justify-between text-xs text-on-surface-variant">
        <span>{remaining} of {limit} Pilot runs left this month</span>
      </div>

      {tokens.length > 0 && (
        <div className="border-t border-outline-variant pt-3 space-y-2">
          <p className="text-xs font-medium text-on-surface">Your tokens</p>
          {tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-on-surface-variant font-mono">…{t.last_four}</span>
              <span className="text-outline">{t.last_used_at ? "last used " + formatDate(t.last_used_at) : "never used"}</span>
              <button onClick={() => revoke(t.id)} className="text-danger hover:underline shrink-0">Revoke</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SectionHead() {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="font-semibold text-on-surface">Pilot in your terminal</span>
      <span className="chip chip-brand shrink-0">Pro</span>
    </div>
  );
}

function Step({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-5 h-5 rounded-full bg-surface-dim text-on-surface-variant text-[11px] flex items-center justify-center">{n}</span>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm text-on-surface">{label}</p>
        {children}
      </div>
    </div>
  );
}
