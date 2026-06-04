"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS = [
  { key: "problem", q: "What painful, repetitive thing should your OS handle?", ph: "e.g. My reps lose track of change requests & touchpoints across leads — it's all in WhatsApp and spreadsheets.", area: true },
  { key: "who", q: "Who uses it day-to-day?", ph: "e.g. Your sales reps" },
  { key: "things", q: "What “things” do you need to track?", ph: "e.g. Leads, touchpoints, change requests" },
  { key: "workflow", q: "If only ONE thing worked end-to-end in a week, what is it?", ph: "e.g. A rep logs a touchpoint → it shows on a prioritized follow-up list" },
  { key: "success", q: "What does success look like in a week?", ph: "e.g. Reps log touchpoints; everyone sees what to do next" },
  { key: "notV1", q: "What is NOT v1? (optional — parks the scope creep)", ph: "e.g. Salesforce sync, ML scoring, Slack alerts" },
] as const;

type Key = (typeof FIELDS)[number]["key"];

export function ScopeForm() {
  const router = useRouter();
  const [v, setV] = useState<Record<Key, string>>({ problem: "", who: "", things: "", workflow: "", success: "", notV1: "" });
  const set = (k: Key, val: string) => setV((s) => ({ ...s, [k]: val }));
  const ready = v.problem.trim() && v.who.trim() && v.things.trim() && v.workflow.trim();
  const [busy, setBusy] = useState(false);

  function brief() {
    return [
      `Problem: ${v.problem.trim()}`,
      `For: ${v.who.trim()}`,
      `Core things to track: ${v.things.trim()}`,
      `The one workflow (must work v1): ${v.workflow.trim()}`,
      v.success.trim() && `Success in a week: ${v.success.trim()}`,
      v.notV1.trim() && `Not v1: ${v.notV1.trim()}`,
    ].filter(Boolean).join("\n");
  }

  function build() {
    if (!ready || busy) return;
    setBusy(true);
    try { sessionStorage.setItem("scopeBrief", brief()); } catch { /* ignore */ }
    router.push("/new-project");
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* Left: guided fields */}
      <div className="lg:col-span-2 space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-sm text-neutral-300">{f.q}</label>
            {("area" in f && f.area) ? (
              <textarea value={v[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.ph} rows={3}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-violet-500 resize-none" />
            ) : (
              <input value={v[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.ph}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-violet-500" />
            )}
          </div>
        ))}
      </div>

      {/* Right: live Scope Brief */}
      <div>
        <div className="border border-white/10 rounded-xl p-4 space-y-3 lg:sticky lg:top-20">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Your scope brief</p>
          <div className="text-sm space-y-2.5">
            <Row label="Problem" val={v.problem} />
            <Row label="For" val={v.who} />
            <Row label="Core things" val={v.things} />
            <Row label="The one workflow" val={v.workflow} />
            <Row label="Success in a week" val={v.success} />
            <Row label="Not v1" val={v.notV1} muted />
          </div>
          <button onClick={build} disabled={!ready || busy}
            className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors mt-1">
            {busy ? "Opening…" : "Build this OS →"}
          </button>
          <p className="text-[11px] text-neutral-600 text-center">Next: name it &amp; provision — your scope seeds the Plan.</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, val, muted = false }: { label: string; val: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className={val.trim() ? (muted ? "text-neutral-400" : "text-neutral-200") : "text-neutral-700"}>
        {val.trim() || "—"}
      </p>
    </div>
  );
}
