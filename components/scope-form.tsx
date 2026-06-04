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
type Mode = "describe" | "upload";
type Doc = { name: string; content: string };

export function ScopeForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("describe");
  const [v, setV] = useState<Record<Key, string>>({ problem: "", who: "", things: "", workflow: "", success: "", notV1: "" });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: Key, val: string) => setV((s) => ({ ...s, [k]: val }));
  const ready = mode === "describe"
    ? !!(v.problem.trim() && v.who.trim() && v.things.trim() && v.workflow.trim())
    : docs.length > 0;

  function brief() {
    if (mode === "upload") {
      return docs.map((d) => `# ${d.name}\n\n${d.content.trim()}`).join("\n\n---\n\n");
    }
    return [
      `Problem: ${v.problem.trim()}`,
      `For: ${v.who.trim()}`,
      `Core things to track: ${v.things.trim()}`,
      `The one workflow (must work v1): ${v.workflow.trim()}`,
      v.success.trim() && `Success in a week: ${v.success.trim()}`,
      v.notV1.trim() && `Not v1: ${v.notV1.trim()}`,
    ].filter(Boolean).join("\n");
  }

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const md = Array.from(list).filter((f) => /\.(md|markdown|txt)$/i.test(f.name));
    const read = await Promise.all(md.map(async (f) => ({ name: f.name, content: await f.text() })));
    setDocs((prev) => {
      const byName = new Map(prev.map((d) => [d.name, d]));
      read.forEach((d) => byName.set(d.name, d));
      return Array.from(byName.values());
    });
  }

  function build() {
    if (!ready || busy) return;
    setBusy(true);
    try { sessionStorage.setItem("scopeBrief", brief()); } catch { /* ignore */ }
    router.push("/new-project");
  }

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="inline-flex border border-white/10 rounded-lg p-1 text-sm">
        <button onClick={() => setMode("describe")}
          className={`px-3 py-1.5 rounded-md transition-colors ${mode === "describe" ? "bg-violet-500/15 text-white border border-violet-500/30" : "text-neutral-400 hover:text-white border border-transparent"}`}>
          ✍️ Describe it
        </button>
        <button onClick={() => setMode("upload")}
          className={`px-3 py-1.5 rounded-md transition-colors ${mode === "upload" ? "bg-violet-500/15 text-white border border-violet-500/30" : "text-neutral-400 hover:text-white border border-transparent"}`}>
          📄 I have a PRD / spec
        </button>
      </div>

      {mode === "describe" ? (
        <div className="grid lg:grid-cols-3 gap-5">
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
          <div>
            <BuildPanel ready={ready} busy={busy} onBuild={build}
              rows={[
                ["Problem", v.problem], ["For", v.who], ["Core things", v.things],
                ["The one workflow", v.workflow], ["Success in a week", v.success], ["Not v1", v.notV1],
              ]} />
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            <label className="block border-2 border-dashed border-white/15 hover:border-violet-500/40 rounded-xl p-8 text-center cursor-pointer transition-colors">
              <input type="file" accept=".md,.markdown,.txt" multiple className="hidden"
                onChange={(e) => onFiles(e.target.files)} />
              <p className="text-2xl mb-1">📄</p>
              <p className="text-sm text-neutral-300">Click to upload your <b>.md</b> files</p>
              <p className="text-xs text-neutral-600 mt-1">PRD, architecture, data model, a skill spec — whatever you&apos;ve already written.</p>
            </label>

            {docs.length > 0 && (
              <div className="border border-white/10 rounded-xl divide-y divide-white/[0.06]">
                {docs.map((d) => (
                  <div key={d.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-neutral-200 truncate">📄 {d.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-neutral-600">{(d.content.length / 1024).toFixed(1)} KB</span>
                      <button onClick={() => setDocs((p) => p.filter((x) => x.name !== d.name))}
                        className="text-neutral-600 hover:text-red-400 text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-neutral-600">
              We&apos;ll provision the repo + database + hosting, drop your docs into the project&apos;s Plan, and hand it to
              your agent — so you skip the annoying setup and go straight to building.
            </p>
          </div>
          <div>
            <BuildPanel ready={ready} busy={busy} onBuild={build} uploadCount={docs.length} />
          </div>
        </div>
      )}
    </div>
  );
}

function BuildPanel({
  ready, busy, onBuild, rows, uploadCount,
}: {
  ready: boolean; busy: boolean; onBuild: () => void;
  rows?: [string, string][]; uploadCount?: number;
}) {
  return (
    <div className="border border-white/10 rounded-xl p-4 space-y-3 lg:sticky lg:top-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {rows ? "Your scope brief" : "Your docs"}
      </p>
      {rows ? (
        <div className="text-sm space-y-2.5">
          {rows.map(([label, val]) => (
            <div key={label}>
              <p className="text-[11px] text-neutral-500">{label}</p>
              <p className={val.trim() ? "text-neutral-200" : "text-neutral-700"}>{val.trim() || "—"}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-300">
          {uploadCount ? `${uploadCount} file${uploadCount === 1 ? "" : "s"} ready to seed your project.` : "Upload your .md files to continue."}
        </p>
      )}
      <button onClick={onBuild} disabled={!ready || busy}
        className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors mt-1">
        {busy ? "Opening…" : "Build this OS →"}
      </button>
      <p className="text-[11px] text-neutral-600 text-center">Next: name it &amp; provision — this seeds the Plan.</p>
    </div>
  );
}
