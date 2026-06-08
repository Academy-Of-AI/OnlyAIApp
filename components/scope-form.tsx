"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELDS = [
  { key: "problem", q: "What do you want to build? (the painful, repetitive thing it handles)", ph: "e.g. My reps lose track of change requests & touchpoints across leads — it's all in WhatsApp and spreadsheets.", area: true },
  { key: "who", q: "Who uses it day-to-day?", ph: "e.g. Your sales reps" },
  { key: "things", q: "What “things” do you need to track?", ph: "e.g. Leads, touchpoints, change requests" },
  { key: "workflow", q: "If only ONE thing worked end-to-end in a week, what is it?", ph: "e.g. A rep logs a touchpoint → it shows on a prioritized follow-up list" },
  { key: "success", q: "What does success look like in a week?", ph: "e.g. Reps log touchpoints; everyone sees what to do next" },
  { key: "notV1", q: "What is NOT v1? (optional — parks the scope creep)", ph: "e.g. Salesforce sync, ML scoring, Slack alerts" },
] as const;

type Key = (typeof FIELDS)[number]["key"];
type Mode = "describe" | "upload";
type DocKind = "prd" | "skill";
type Doc = { name: string; content: string; kind: DocKind };
type PlanningMode = "ground_truth" | "skip";

// PRD/plan vs skill spec — guess from the filename, the user can override.
const guessKind = (name: string): DocKind => (/skill/i.test(name) ? "skill" : "prd");

export function ScopeForm({ initialProblem = "" }: { initialProblem?: string } = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("describe");
  const [v, setV] = useState<Record<Key, string>>({ problem: initialProblem, who: "", things: "", workflow: "", success: "", notV1: "" });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [planningMode, setPlanningMode] = useState<PlanningMode>("ground_truth");
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: Key, val: string) => setV((s) => ({ ...s, [k]: val }));
  const ready = mode === "describe"
    ? !!(v.problem.trim() && v.who.trim() && v.things.trim() && v.workflow.trim())
    : docs.length > 0;

  function describeBrief() {
    return [
      `Problem: ${v.problem.trim()}`,
      `For: ${v.who.trim()}`,
      `Core things to track: ${v.things.trim()}`,
      `The one workflow (must work v1): ${v.workflow.trim()}`,
      v.success.trim() && `Success in a week: ${v.success.trim()}`,
      v.notV1.trim() && `Not v1: ${v.notV1.trim()}`,
    ].filter(Boolean).join("\n");
  }

  // The build_prompt seed for an uploaded set = the PRD/plan docs combined
  // (skill specs go to the repo, not the plan). Falls back to all docs.
  function uploadSeed() {
    const prd = docs.filter((d) => d.kind !== "skill");
    return (prd.length ? prd : docs).map((d) => `# ${d.name}\n\n${d.content.trim()}`).join("\n\n---\n\n");
  }

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const md = Array.from(list).filter((f) => /\.(md|markdown|txt)$/i.test(f.name));
    const read = await Promise.all(
      md.map(async (f) => ({ name: f.name, content: await f.text(), kind: guessKind(f.name) })),
    );
    setDocs((prev) => {
      const byName = new Map(prev.map((d) => [d.name, d]));
      read.forEach((d) => byName.set(d.name, d));
      return Array.from(byName.values());
    });
  }

  function build() {
    if (!ready || busy) return;
    setBusy(true);
    try {
      if (mode === "upload") {
        sessionStorage.setItem("scopeBrief", uploadSeed());
        sessionStorage.setItem("scopeUpload", JSON.stringify({
          docs: docs.map((d) => ({ name: d.name, content: d.content, kind: d.kind })),
          mode: planningMode,
        }));
      } else {
        sessionStorage.setItem("scopeBrief", describeBrief());
      }
    } catch { /* ignore */ }
    router.push("/new-project");
  }

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="inline-flex border border-outline-variant bg-surface-low rounded-lg p-1 text-sm">
        <button onClick={() => setMode("describe")}
          className={`px-3 py-1.5 rounded-md transition-colors ${mode === "describe" ? "bg-brand-container text-brand-dim border border-brand-border" : "text-on-surface-variant hover:text-on-surface border border-transparent"}`}>
          ✍️ Describe it
        </button>
        <button onClick={() => setMode("upload")}
          className={`px-3 py-1.5 rounded-md transition-colors ${mode === "upload" ? "bg-brand-container text-brand-dim border border-brand-border" : "text-on-surface-variant hover:text-on-surface border border-transparent"}`}>
          📄 I have a PRD / spec
        </button>
      </div>

      {mode === "describe" ? (
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-sm text-on-surface-variant">{f.q}</label>
                {("area" in f && f.area) ? (
                  <textarea value={v[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.ph} rows={3}
                    className="cap-input resize-none" />
                ) : (
                  <input value={v[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.ph}
                    className="cap-input" />
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
            {/* Drag & drop OR click to upload */}
            <label
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); onFiles(e.dataTransfer.files); }}
              className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragActive ? "border-brand-border bg-brand-container" : "border-outline-variant hover:border-brand-border"
              }`}
            >
              <input type="file" accept=".md,.markdown,.txt" multiple className="hidden"
                onChange={(e) => onFiles(e.target.files)} />
              <p className="text-2xl mb-1">📄</p>
              <p className="text-sm text-on-surface-variant">
                <span className="text-brand">Drag &amp; drop</span> your <b>.md</b> files here, or click to browse
              </p>
              <p className="text-xs text-outline mt-1">PRD, architecture, data model, a skill spec — whatever you&apos;ve already written.</p>
            </label>

            {docs.length > 0 && (
              <div className="panel divide-y divide-[var(--color-outline-variant)]">
                {docs.map((d) => (
                  <div key={d.name} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="text-on-surface truncate min-w-0">📄 {d.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={d.kind}
                        onChange={(e) => setDocs((p) => p.map((x) => x.name === d.name ? { ...x, kind: e.target.value as DocKind } : x))}
                        className="bg-surface border border-outline-variant rounded px-1.5 py-0.5 text-[11px] text-on-surface-variant outline-none focus:border-brand"
                        title="PRD/plan → shapes the plan & database · Skill → goes into your repo for the agent"
                      >
                        <option value="prd">PRD / plan</option>
                        <option value="skill">Skill / repo</option>
                      </select>
                      <span className="text-[11px] text-outline hidden sm:inline">{(d.content.length / 1024).toFixed(1)} KB</span>
                      <button onClick={() => setDocs((p) => p.filter((x) => x.name !== d.name))}
                        className="text-outline hover:text-danger text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Planning mode — only relevant once there are docs */}
            {docs.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-on-surface-variant uppercase tracking-wider">How should we use them?</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <ModeCard
                    active={planningMode === "ground_truth"}
                    onClick={() => setPlanningMode("ground_truth")}
                    title="Build the plan from my docs"
                    desc="Recommended. We structure your docs into the plan, fill any gaps, and set up your database from them."
                  />
                  <ModeCard
                    active={planningMode === "skip"}
                    onClick={() => setPlanningMode("skip")}
                    title="Skip planning — I've got this"
                    desc="Commit your docs as-is, set up the repo + database from them, hand off. Fastest."
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-outline">
              We&apos;ll provision the repo + database + hosting, put your docs in place, and hand it to your agent —
              so you skip the annoying setup and go straight to building.
            </p>
          </div>
          <div>
            <BuildPanel ready={ready} busy={busy} onBuild={build} uploadCount={docs.length} planningMode={planningMode} />
          </div>
        </div>
      )}
    </div>
  );
}

function ModeCard({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button onClick={onClick}
      className={`text-left rounded-lg border p-3 transition-colors ${
        active ? "border-brand-border bg-brand-container" : "border-outline-variant bg-surface-low hover:border-outline"
      }`}>
      <div className="flex items-center gap-2">
        <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${active ? "border-brand bg-brand" : "border-outline"}`} />
        <span className="text-sm font-medium text-on-surface">{title}</span>
      </div>
      <p className="text-[11px] text-on-surface-variant mt-1 ml-[22px]">{desc}</p>
    </button>
  );
}

function BuildPanel({
  ready, busy, onBuild, rows, uploadCount, planningMode,
}: {
  ready: boolean; busy: boolean; onBuild: () => void;
  rows?: [string, string][]; uploadCount?: number; planningMode?: PlanningMode;
}) {
  return (
    <div className="panel p-4 space-y-3 lg:sticky lg:top-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        {rows ? "Your scope brief" : "Your docs"}
      </p>
      {rows ? (
        <div className="text-sm space-y-2.5">
          {rows.map(([label, val]) => (
            <div key={label}>
              <p className="text-[11px] text-on-surface-variant">{label}</p>
              <p className={val.trim() ? "text-on-surface" : "text-outline"}>{val.trim() || "—"}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm space-y-1.5">
          <p className="text-on-surface-variant">
            {uploadCount ? `${uploadCount} file${uploadCount === 1 ? "" : "s"} ready to seed your project.` : "Upload your .md files to continue."}
          </p>
          {!!uploadCount && (
            <p className="text-[11px] text-on-surface-variant">
              {planningMode === "skip" ? "Skip planning — repo + database from your docs." : "Plan built from your docs."}
            </p>
          )}
        </div>
      )}
      <button onClick={onBuild} disabled={!ready || busy}
        className="btn-brand w-full text-sm px-4 py-2.5 mt-1">
        {busy ? "Opening…" : "Start building →"}
      </button>
      <p className="text-[11px] text-outline text-center">Next: name it &amp; provision — this seeds the Plan.</p>
    </div>
  );
}
