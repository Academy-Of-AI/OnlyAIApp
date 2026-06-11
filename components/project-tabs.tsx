"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { PlanPack, type Result as PlanPackResult } from "@/components/plan-pack";
import { PlanProgress } from "@/components/plan-progress";
import { AutoCaptureToggle } from "@/components/auto-capture-toggle";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { ExplainError } from "@/components/explain-error";
import { LaunchCheck } from "@/components/launch-check";
import { DriftPanel } from "@/components/drift-panel";
import { DeployButton } from "@/components/deploy-button";
import { STEP_LABELS } from "@/lib/provisioning/steps";
import { formatDate, formatDateTime } from "@/lib/date";

type Project = {
  id: string;
  name: string;
  status: string;
  template_id: string;
  github_repo_url: string | null;
  vercel_preview_url: string | null;
  vercel_project_id: string | null;
  supabase_project_ref: string | null;
  error: string | null;
  provision_step: string | null;
  provision_started_at: string | null;
  created_at: string;
  deployed_at: string | null;
  build_prompt: string | null;
  last_digest: { onTrack: boolean; note: string; scopeCreep?: string[] } | null;
  plan_progress?: string[] | null;
};

const STATUS_STYLES: Record<string, string> = {
  deployed:     "chip chip-success",
  provisioning: "chip chip-warn",
  building:     "chip chip-warn",
  pending:      "chip chip-neutral",
  failed:       "chip chip-danger",
};

// Mirrors the SSE progress event emitted by POST /api/projects (same shape the
// new-project page consumes). Used by the failed-project Retry surface.
type StepEvent = { step: string; message: string; detail?: string };

type View = "plan" | "pilot" | "settings";

type Hardened = { payments: boolean; monitoring: boolean; hardened: boolean };

export function ProjectTabs({
  project,
  memory = [],
  liveUrl = null,
  initialPack = null,
  autoCapture = false,
  isPro = false,
  hardened,
  addons = null,
  stalled = false,
  freePlansLeft = null,
}: {
  project: Project;
  memory?: Array<{ kind: string; content: string }>;
  liveUrl?: string | null;
  initialPack?: PlanPackResult | null;
  autoCapture?: boolean;
  isPro?: boolean;
  hardened?: Hardened;
  freePlansLeft?: number | null;
  addons?: React.ReactNode;
  stalled?: boolean;
}) {
  const [view, setView] = useState<View>("plan");
  const pnav = (active: boolean) =>
    `rounded-lg border px-3 py-2.5 flex items-center gap-2 transition-colors text-left ${
      active ? "border-brand-border bg-brand-container text-brand-dim" : "border-outline-variant text-on-surface-variant hover:border-outline"
    }`;

  // A failed provision — OR one stuck in 'provisioning' past the stale window
  // (the function timed out / the page closed mid-run, so the failure path never
  // recorded it) — never finished setting the app up. The 3 Ps (Plan/Pilot) and
  // the "Skip — use my docs" planning path are dead ends for it. Show a focused
  // recovery surface instead: where setup stopped, the error, and a Retry button.
  // `stalled` is computed server-side (page.tsx) to avoid a hydration mismatch.
  if (project.status === "failed" || stalled) {
    return <FailedProjectView project={project} stalled={stalled} />;
  }

  return (
    <div>
      {/* Header — name, status, Settings gear, GitHub / Live app */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display tracking-tight text-2xl font-bold text-on-surface truncate">{project.name}</h1>
            <span className={STATUS_STYLES[project.status] ?? STATUS_STYLES.pending}>{project.status}</span>
            <button onClick={() => setView("settings")} title="Settings"
              className={`text-lg leading-none transition-colors ${view === "settings" ? "text-brand" : "text-on-surface-variant hover:text-on-surface"}`}>⚙</button>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">Created {formatDate(project.created_at)}</p>
          {project.error && <p className="text-xs text-danger mt-1 truncate max-w-lg">{project.error}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          {project.github_repo_url && (
            <a href={project.github_repo_url} target="_blank" rel="noopener noreferrer"
              className="btn-ghost text-sm px-3 py-1.5">GitHub →</a>
          )}
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer"
              className="btn-brand text-sm font-semibold px-4 py-1.5">↗ Live app</a>
          )}
        </div>
      </div>

      {/* Go live — the in-app deploy. Shown until the app actually has a live URL,
          so a non-technical user can reach a real URL without a terminal. */}
      {!liveUrl && project.github_repo_url && project.status !== "provisioning" && project.status !== "building" && (
        <div className="mb-6">
          <DeployButton projectId={project.id} projectPath={`/projects/${project.id}`} />
        </div>
      )}

      {/* The 3 Ps — the only nav (no tab bar) */}
      <div className="grid grid-cols-3 gap-2 text-sm mb-8">
        <div className="rounded-lg border border-outline-variant bg-surface-low px-3 py-2.5 flex items-center gap-2"><span className="text-on-surface-variant">①</span><span className="font-semibold">Provision</span><span className="ml-auto text-xs text-success">✓</span></div>
        <button onClick={() => setView("plan")} className={pnav(view === "plan")}><span className="text-brand">②</span><span className="font-semibold">Plan</span></button>
        <button onClick={() => setView("pilot")} className={pnav(view === "pilot")}><span className="text-brand">③</span><span className="font-semibold">Pilot</span></button>
      </div>

      {view === "plan" && <PlanView project={project} initialPack={initialPack} freePlansLeft={freePlansLeft} />}
      {view === "pilot" && <PilotView project={project} memory={memory} liveUrl={liveUrl} autoCapture={autoCapture} isPro={isPro} hardened={hardened} onHarden={() => setView("settings")} plan={initialPack?.plan ?? null} sprints={initialPack?.sprints ?? []} />}
      {view === "settings" && <SettingsTab project={project} addons={addons} />}
    </div>
  );
}

/* ── Failed-project recovery surface ──────────────────────────────────────
   When a provision fails, the normal Plan/Pilot tabs (and the "Skip — use my
   docs" planning path) are dead ends — the app was never finished. Show where
   setup stopped, the stored (plain-English) error, and a Retry that re-runs
   provisioning by POSTing /api/projects with { projectId }, consuming the SSE
   stream the same way new-project/page.tsx does.
   STEP_LABELS is shared from lib/provisioning/steps (single source of truth —
   same vocabulary the server uses to record provision_step). */
function FailedProjectView({ project, stalled = false }: { project: Project; stalled?: boolean }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [retryError, setRetryError] = useState<string | null>(null);

  const stoppedAt = project.provision_step
    ? (STEP_LABELS[project.provision_step as keyof typeof STEP_LABELS] ?? project.provision_step)
    : "the start";

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    setSteps([]);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });

    if (!response.body) {
      setRetryError("No response stream");
      setRetrying(false);
      return;
    }

    // Non-streaming error (auth/validation/plan limits) — surfaced as JSON.
    if (!response.ok && response.headers.get("Content-Type")?.includes("application/json")) {
      const j = (await response.json()) as { error?: string };
      setRetryError(j.error ?? "Retry failed");
      setRetrying(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // Track a terminal event so a dropped/ended stream still clears the spinner.
    let sawTerminal = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const event = JSON.parse(line.slice(6)) as
              | { step: "done"; result: unknown }
              | { step: "error"; message: string }
              | StepEvent;

            if (event.step === "done") {
              sawTerminal = true;
              // Provision succeeded — reload so the page shows the live project.
              router.refresh();
            } else if (event.step === "error") {
              sawTerminal = true;
              setRetryError((event as { step: "error"; message: string }).message);
            } else {
              setSteps((prev) => {
                const last = prev[prev.length - 1];
                if (last?.step === event.step) return [...prev.slice(0, -1), event as StepEvent];
                return [...prev, event as StepEvent];
              });
            }
          } catch {
            // parse error, skip
          }
        }
      }
    } catch {
      if (!sawTerminal) {
        setRetryError("The connection dropped while retrying setup. Check back in a minute — it may have finished — or try again.");
      }
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div>
      {/* Header — name + failed chip */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display tracking-tight text-2xl font-bold text-on-surface truncate">{project.name}</h1>
            <span className={stalled ? STATUS_STYLES.provisioning : STATUS_STYLES.failed}>{stalled ? "stuck" : project.status}</span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">Created {formatDate(project.created_at)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.06)] p-5 sm:p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-danger flex items-center gap-2">
            {stalled ? "🟠 Setup seems stuck" : "🔴 Setup didn’t finish"}
          </p>
          <p className="text-sm text-on-surface mt-1.5">
            Setup stopped at: <span className="font-semibold text-on-surface">{stoppedAt}</span>
          </p>
        </div>

        {project.error ? (
          <div>
            <p className="text-xs uppercase tracking-wide text-on-surface-variant mb-1 font-medium">What went wrong</p>
            <p className="text-sm text-on-surface leading-relaxed">{project.error}</p>
          </div>
        ) : stalled ? (
          <p className="text-sm text-on-surface-variant leading-relaxed">
            This usually means setup ran out of time partway through. Retrying picks up right where it stopped — nothing is lost.
          </p>
        ) : null}

        {/* Live retry progress */}
        {retrying && (
          <div className="space-y-2 py-1">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-success">✓</span>
                <span className={i === steps.length - 1 ? "text-on-surface" : "text-on-surface-variant"}>{s.message}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 text-sm text-on-surface-variant">
              <span className="w-4 h-4 border-2 border-outline-variant border-t-brand rounded-full animate-spin inline-block flex-shrink-0" />
              <span>Picking up where it stopped…</span>
            </div>
          </div>
        )}

        {retryError && !retrying && (
          <div className="panel border-l-2 border-l-danger text-danger text-sm px-4 py-3">{retryError}</div>
        )}

        {/* Primary: Retry setup — re-runs provisioning, resuming from where it stopped. */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={retry}
            disabled={retrying}
            className="btn-brand text-sm font-semibold px-5 py-2.5"
          >
            {retrying ? "Retrying setup…" : "🔄 Retry setup"}
          </button>
          <Link href="/dashboard" className="text-xs text-on-surface-variant hover:text-on-surface transition-colors">
            ← Back to dashboard
          </Link>
        </div>
      </div>

      {/* Self-serve recovery hint — repo access is the #1 cause of a stuck provision. */}
      <p className="text-xs text-on-surface-variant mt-4">
        Keeps failing? Make sure GitHub and Vercel are connected in{" "}
        <Link href="/settings" className="text-brand hover:text-brand-dim">Settings ⚙</Link>, then retry.
      </p>
    </div>
  );
}

/* ── Plan view ─────────────────────────────────────────────────────────── */
function PlanView({
  project, initialPack = null, freePlansLeft = null,
}: {
  project: Project; initialPack?: PlanPackResult | null; freePlansLeft?: number | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display tracking-tight text-lg font-semibold text-on-surface mb-1">Plan it, then build it</h2>
        <p className="text-sm text-on-surface-variant">
          Start with a Plan Pack — a PRD, architecture, data model and sprint plan committed to your
          repo. Then hand it to your agent (Claude Code) to build it, the reliable way.
        </p>
      </div>
      <PlanPack project={project} initialPack={initialPack} freePlansLeft={freePlansLeft} />
    </div>
  );
}

/* ── Pilot view — keep it on course (auto-capture + drift + memory) & ship it ── */
function PilotView({
  project, memory = [], liveUrl = null, autoCapture = false, isPro = false, hardened, onHarden, plan = null, sprints = [],
}: {
  project: Project; memory?: Array<{ kind: string; content: string }>; liveUrl?: string | null; autoCapture?: boolean; isPro?: boolean;
  hardened?: { payments: boolean; monitoring: boolean; hardened: boolean }; onHarden?: () => void;
  plan?: { now?: string[]; next?: string[]; later?: string[] } | null; sprints?: Array<{ title: string; items: string[] }>;
}) {
  const broken = project.status === "failed";
  const drifting = project.last_digest?.onTrack === false;
  const verdict = broken
    ? { dot: "bg-danger", head: `${project.name} needs you`, sub: "The last build failed — fix it to keep moving." }
    : drifting
      ? { dot: "bg-warn", head: "Heads up — drifting from your plan", sub: project.last_digest?.note ?? "Some recent work looks off-plan." }
      : { dot: "bg-success", head: "On track", sub: "Building on plan. Tick items off as they ship." };
  return (
    <div className="space-y-6">
      {!isPro && (
        <div>
          <h2 className="font-display tracking-tight text-lg font-semibold text-on-surface mb-1">Pilot — keep it on course &amp; ship it</h2>
          <p className="text-sm text-on-surface-variant">
            As you build, Pilot quietly tracks what changed and why, flags drift from your plan, and helps
            you launch — so you never write anything down, and the AI always knows your project.
          </p>
        </div>
      )}

      {!isPro && (
        <div className="relative">
          {/* Blurred teaser of what Pilot shows */}
          <div className="blur-[3px] select-none pointer-events-none space-y-3" aria-hidden>
            <div className="panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5"><span className="dot bg-success" />On track</p>
              <p className="text-sm text-on-surface-variant mt-1">Auto-captured: added the records table + create form, wired to the database. No drift from the plan.</p>
            </div>
            <div className="panel p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Launch readiness</p>
              <p className="text-sm text-on-surface-variant mt-1 tabnum">7 checks · 1 left before you can launch</p>
            </div>
          </div>
          {/* Upgrade overlay */}
          <div className="absolute inset-0 grid place-items-center px-4">
            <div className="panel p-6 text-center space-y-3 max-w-sm" style={{ boxShadow: "0 8px 30px rgba(16,24,40,.14)" }}>
              <p className="text-3xl">🛫</p>
              <p className="eyebrow">Pro feature</p>
              <h3 className="font-display tracking-tight text-lg font-bold text-on-surface">Unlock Pilot for this build</h3>
              <p className="text-sm text-on-surface-variant">Auto-capture, drift detection &amp; launch-readiness checks — so the AI always knows your project and nothing slips.</p>
              <a href="/upgrade" className="btn-brand inline-block text-sm px-5 py-2.5">✨ Upgrade to Pro</a>
            </div>
          </div>
        </div>
      )}

      {isPro && (<>
      {/* Verdict — on course vs the plan? */}
      <div>
        <p className="eyebrow">Pilot · on course?</p>
        <h2 className="font-display tracking-tight text-lg font-bold text-on-surface flex items-center gap-2">
          <span className={`dot ${verdict.dot}`} />{verdict.head}
        </h2>
        <p className="text-sm text-on-surface-variant mt-0.5">{verdict.sub}</p>
      </div>

      {/* If the last deploy broke, turn the scary error into one next step (replaces the raw error line). */}
      <ExplainError projectId={project.id} />

      {/* On a drifting project, surface the one move back on plan (enhanced DriftPanel). */}
      {drifting && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5 text-on-surface-variant">Back on course</p>
          <DriftPanel projectId={project.id} hasPlan={!!plan} />
        </div>
      )}

      {/* The spine — progress vs the plan (Now / Next / Later + sprints) */}
      <PlanProgress projectId={project.id} plan={plan} sprints={sprints} initialDone={project.plan_progress ?? []} />

      {/* Instruments — supporting gauges */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5 text-on-surface-variant">Instruments</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className={`rounded-lg border p-3 bg-surface-low ${broken ? "border-danger/40" : "border-outline-variant"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Deploy</p>
            <p className={`text-sm font-semibold mt-0.5 ${broken ? "text-danger" : liveUrl ? "text-success" : "text-on-surface-variant"}`}>{broken ? "Broken" : liveUrl ? "Live" : "—"}</p>
          </div>
          <div className="rounded-lg border border-outline-variant p-3 bg-surface-low">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">What changed</p>
            <p className="text-sm font-semibold mt-0.5 text-on-surface tabnum">{memory.length} captured</p>
          </div>
          <div className="rounded-lg border border-outline-variant p-3 bg-surface-low">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">On plan</p>
            <p className={`text-sm font-semibold mt-0.5 ${drifting ? "text-warn" : "text-success"}`}>{drifting ? "Drifting" : "On track"}</p>
          </div>
          <div className="rounded-lg border border-outline-variant p-3 bg-surface-low">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Launch ready</p>
            <p className="text-sm font-semibold mt-0.5 text-on-surface-variant">Check below</p>
          </div>
        </div>
      </div>

      {/* Hardened — production-readiness for this app (links to add-ons in Settings) */}
      {hardened && (
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
              🛡️ Hardened
            </p>
            {onHarden && <button onClick={onHarden} className="text-xs text-brand-dim hover:underline">Harden this app →</button>}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className={`chip ${hardened.payments ? "chip-success" : "chip-neutral"}`}>{hardened.payments ? "Payments ✓" : "Payments —"}</span>
            <span className={`chip ${hardened.monitoring ? "chip-success" : "chip-neutral"}`}>{hardened.monitoring ? "Monitoring ✓" : "Monitoring —"}</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">
            {hardened.hardened ? "Production add-ons are wired up for this app." : "Add payments or monitoring to make this app production-grade."}
          </p>
        </div>
      )}

      <AutoCaptureToggle projectId={project.id} enabled={autoCapture} />

      {project.last_digest && (
        <div className="panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className={`dot ${project.last_digest.onTrack ? "bg-success" : "bg-warn"}`} />
            <span className="text-on-surface-variant">{project.last_digest.onTrack ? "On track" : "Heads up"}</span>
          </p>
          <p className="text-sm text-on-surface-variant">{project.last_digest.note}</p>
          {(project.last_digest.scopeCreep ?? []).length > 0 && (
            <ul className="mt-2 space-y-1">
              {(project.last_digest.scopeCreep ?? []).map((s, i) => (
                <li key={i} className="text-xs text-on-surface-variant">• {s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {memory.length > 0 && (
        <div className="panel p-5">
          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">What OnlyAIApp remembers about this project</p>
          <div className="divide-y divide-[var(--color-outline-variant)]">
            {memory.map((mItem, i) => (
              <div key={i} className="flex gap-2 py-2 text-sm">
                <span className="text-[10px] text-on-surface-variant bg-surface-high rounded px-1.5 py-0.5 h-fit whitespace-nowrap">{mItem.kind}</span>
                <span className="text-on-surface-variant">{mItem.content}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-outline mt-3">Picked up automatically as you build — so the AI always knows your project.</p>
        </div>
      )}

      {/* Honest finish-line check — deployed, real (not a login wall), core shipped. */}
      <LaunchCheck projectId={project.id} />

      <LaunchTab project={project} liveUrl={liveUrl} />
      </>)}
    </div>
  );
}

/* ── Launch tab — launch-readiness checks + Claude Code fix tasks ─────────── */
function LaunchTab({ project, liveUrl = null }: { project: Project; liveUrl?: string | null }) {
  type Check = { id: string; label: string; status: "pass" | "fail" | "warn" | "unknown"; detail: string; claudeTask?: string };
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/launch-check`);
      const data = await res.json();
      setChecks(Array.isArray(data.checks) ? data.checks : []);
    } catch {
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }

  function copy(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  const icon = (s: Check["status"]) => (s === "pass" ? "✓" : s === "fail" ? "✕" : s === "warn" ? "!" : "○");
  const color = (s: Check["status"]) => (s === "pass" ? "text-success" : s === "fail" ? "text-danger" : s === "warn" ? "text-warn" : "text-on-surface-variant");
  const remaining = checks?.filter((c) => c.status === "fail" || c.status === "warn").length ?? 0;

  // Definition of Done (client-side certainty gate for v1)
  const canSubmit = checks !== null && remaining === 0;

  // Submit to The Wall (when launch-ready)
  const [wTitle, setWTitle] = useState(project.name);
  const [wTagline, setWTagline] = useState("");
  const [wDemo, setWDemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  async function submitToWall() {
    if (!wTitle.trim() || !wDemo.trim() || submitting) return;
    setSubmitting(true); setSubmitErr(null);
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, title: wTitle.trim(), tagline: wTagline.trim(), demoUrl: wDemo.trim() }),
      });
      const d = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) setSubmitErr(d.error ?? "Couldn't submit.");
      else setSubmitted(true);
    } catch {
      setSubmitErr("Couldn't submit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display tracking-tight text-lg font-semibold text-on-surface mb-1">Launch readiness</h2>
        <p className="text-sm text-on-surface-variant">
          We check what separates &quot;it built&quot; from &quot;it&apos;s actually launched&quot; — then hand you the exact task to
          paste into your Claude Code for anything that isn&apos;t ready yet.
        </p>
      </div>

      {!checks && (
        <button onClick={run} disabled={loading}
          className="btn-brand text-sm font-semibold px-4 py-2">
          {loading ? "Checking…" : "Check launch readiness"}
        </button>
      )}

      {checks && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-on-surface-variant">
              {remaining === 0 ? "🎉 All clear — you're launch-ready." : `${remaining} thing${remaining === 1 ? "" : "s"} left before launch.`}
            </p>
            <button onClick={run} disabled={loading}
              className="btn-ghost text-xs px-3 py-1.5">
              {loading ? "…" : "Re-check"}
            </button>
          </div>

          <div className="space-y-3">
            {checks.map((c) => (
              <div key={c.id} className="panel p-4">
                <div className="flex items-start gap-3">
                  <span className={`${color(c.status)} font-bold w-4 text-center`}>{icon(c.status)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">{c.label}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{c.detail}</p>
                    {c.claudeTask && (
                      <div className="mt-3 flex items-start gap-2">
                        <code className="flex-1 text-xs font-mono bg-surface border border-outline-variant rounded-lg px-3 py-2 text-brand-dim leading-relaxed">{c.claudeTask}</code>
                        <button onClick={() => copy(c.id, c.claudeTask!)}
                          className="btn-ghost text-xs px-3 py-2 shrink-0">
                          {copied === c.id ? "Copied" : "Copy task"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-outline">Paste a task into your Claude Code, let it fix it, push — then hit Re-check.</p>

          {canSubmit && (
            <div className="border border-brand-border bg-brand-container rounded-xl p-4 space-y-3">
              {submitted ? (
                <div className="text-sm">
                  <p className="text-success font-medium">🎉 Submitted to The Wall!</p>
                  <a href="/wall" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline text-sm">See it on The Wall →</a>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-on-surface">🧱 You&apos;re launch-ready — put it on The Wall</p>
                  <input value={wTitle} onChange={(e) => setWTitle(e.target.value)} placeholder="Title"
                    className="cap-input" />
                  <input value={wTagline} onChange={(e) => setWTagline(e.target.value)} placeholder="One line — what does it do?"
                    className="cap-input" />
                  <input value={wDemo} onChange={(e) => setWDemo(e.target.value)} placeholder="Demo link (60-sec video or live URL)"
                    className="cap-input" />
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={submitToWall} disabled={submitting || !wTitle.trim() || !wDemo.trim()}
                      className="btn-brand text-sm font-semibold px-4 py-2">
                      {submitting ? "Submitting…" : "Submit to The Wall"}
                    </button>
                    {submitErr && <span className="text-xs text-danger">{submitErr}</span>}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

    </div>
  );
}

/* ── Settings tab ───────────────────────────────────────────────────────── */
function SettingsTab({ project, addons = null }: { project: Project; addons?: React.ReactNode }) {
  const router = useRouter();
  const [name, setName]               = useState(project.name);
  const [url, setUrl]                 = useState(project.vercel_preview_url ?? "");
  const [editingName, setEditingName] = useState(false);
  const [editingUrl, setEditingUrl]   = useState(false);
  const [saving, setSaving]           = useState<"name" | "url" | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [saved, setSaved]             = useState<"name" | "url" | null>(null);

  async function save(field: "name" | "url") {
    setError(null);
    setSaving(field);
    const body =
      field === "name" ? { name } : { vercel_preview_url: url };

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Save failed");
    } else {
      if (field === "name") setEditingName(false);
      if (field === "url")  setEditingUrl(false);
      setSaved(field);
      setTimeout(() => setSaved(null), 2000);
      // Re-fetch server component so other tabs (e.g. Build) see the new URL
      router.refresh();
    }
  }

  function copyToClipboard(value: string) {
    navigator.clipboard.writeText(value);
  }

  const readOnlyRows: { label: string; value: string | null; href?: string; copy?: boolean }[] = [
    { label: "Status",         value: project.status },
    { label: "Created",        value: formatDateTime(project.created_at) },
    { label: "Deployed",       value: project.deployed_at ? formatDateTime(project.deployed_at) : "—" },
    { label: "GitHub repo",    value: project.github_repo_url, href: project.github_repo_url ?? undefined },
    { label: "Supabase ref",   value: project.supabase_project_ref, copy: true },
    { label: "Vercel project", value: project.vercel_project_id },
  ];

  return (
    <div className="max-w-xl space-y-6">
      {error && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div>
        <h2 className="font-display tracking-tight text-base font-semibold text-on-surface mb-4">Project details</h2>
        <div className="panel overflow-hidden divide-y divide-[var(--color-outline-variant)]">

          {/* Editable: name */}
          <div className="flex items-center justify-between px-5 py-3 text-sm gap-4">
            <span className="text-on-surface-variant w-36 shrink-0">Project name</span>
            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
              {editingName ? (
                <>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="cap-input w-48"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save("name");
                      if (e.key === "Escape") { setName(project.name); setEditingName(false); }
                    }}
                  />
                  <button
                    onClick={() => save("name")}
                    disabled={saving === "name"}
                    className="btn-brand text-xs font-semibold px-2.5 py-1"
                  >
                    {saving === "name" ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setName(project.name); setEditingName(false); }}
                    className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="text-on-surface truncate">{name}</span>
                  {saved === "name" && <span className="text-xs text-success">Saved ✓</span>}
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-outline hover:text-on-surface text-xs transition-colors ml-1"
                    title="Edit"
                  >✎</button>
                </>
              )}
            </div>
          </div>

          {/* Editable: live URL */}
          <div className="flex items-center justify-between px-5 py-3 text-sm gap-4">
            <span className="text-on-surface-variant w-36 shrink-0">Live URL</span>
            <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
              {editingUrl ? (
                <>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="cap-input w-56"
                    autoFocus
                    placeholder="https://your-app.vercel.app"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") save("url");
                      if (e.key === "Escape") { setUrl(project.vercel_preview_url ?? ""); setEditingUrl(false); }
                    }}
                  />
                  <button
                    onClick={() => save("url")}
                    disabled={saving === "url"}
                    className="btn-brand text-xs font-semibold px-2.5 py-1"
                  >
                    {saving === "url" ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setUrl(project.vercel_preview_url ?? ""); setEditingUrl(false); }}
                    className="text-xs text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-dim truncate transition-colors"
                    >
                      {url}
                    </a>
                  ) : (
                    <span className="text-outline">—</span>
                  )}
                  {saved === "url" && <span className="text-xs text-success">Saved ✓</span>}
                  <button
                    onClick={() => setEditingUrl(true)}
                    className="text-outline hover:text-on-surface text-xs transition-colors ml-1"
                    title="Edit"
                  >✎</button>
                </>
              )}
            </div>
          </div>

          {/* Read-only rows */}
          {readOnlyRows.map(({ label, value, href, copy }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3 text-sm">
              <span className="text-on-surface-variant w-36 shrink-0">{label}</span>
              <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                {href && value ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:text-brand-dim truncate transition-colors"
                  >
                    {value}
                  </a>
                ) : (
                  <span className="text-on-surface truncate">{value ?? "—"}</span>
                )}
                {copy && value && (
                  <button
                    onClick={() => copyToClipboard(value)}
                    className="text-outline hover:text-on-surface-variant text-xs shrink-0 transition-colors"
                    title="Copy"
                  >
                    ⎘
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connections — what THIS app is auto-wired to */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-on-surface">
          Connections <span className="text-xs font-normal text-on-surface-variant">— set up automatically</span>
        </h3>
        <p className="text-xs text-on-surface-variant">
          What this app is wired to. Account tokens (used to provision new apps) are managed in{" "}
          <a href="/settings" className="text-brand hover:text-brand-dim">Settings ⚙</a>.
        </p>
        <div className="panel overflow-hidden divide-y divide-[var(--color-outline-variant)]">
          <IntegrationRow icon="" name="GitHub" ok={!!project.github_repo_url}
            status={project.github_repo_url ? "Connected" : "Not linked"}
            href={project.github_repo_url ?? undefined} hrefLabel="Open repo →" />
          <IntegrationRow icon="▲" name="Vercel" ok={!!project.vercel_preview_url}
            status={project.vercel_preview_url ? "Deployed" : "Not deployed"}
            href={project.vercel_preview_url ?? undefined} hrefLabel="Open live →" />
          <IntegrationRow icon="⚡" name="Supabase" ok={!!project.supabase_project_ref}
            status={project.supabase_project_ref ? "Provisioned" : "Not provisioned"}
            href={project.supabase_project_ref ? `https://supabase.com/dashboard/project/${project.supabase_project_ref}` : undefined}
            hrefLabel="Open database →" />
          <IntegrationRow icon="✉" name="Resend" ok={false} muted
            status="Email is injected from your account key"
            href="/settings" hrefLabel="Manage →" />
        </div>
      </div>

      {/* App add-ons + custom domain + Advanced — inline, no separate page */}
      {addons}

      <div className="border border-danger/20 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-danger">Danger zone</h3>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Permanently delete this project. This also deletes its Supabase database and Vercel
          deployment — freeing a slot under your Supabase limit. Your GitHub repo is kept (delete it
          on GitHub if you want it gone).
        </p>
        <DeleteProjectButton projectId={project.id} projectName={project.name} redirectTo="/dashboard" variant="button" />
      </div>
    </div>
  );
}

function IntegrationRow({
  icon, name, status, ok, href, hrefLabel, muted = false,
}: {
  icon: string; name: string; status: string; ok: boolean;
  href?: string; hrefLabel?: string; muted?: boolean;
}) {
  const external = href?.startsWith("http");
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-on-surface-variant shrink-0">{icon}</span>}
        <span className="font-medium text-on-surface">{name}</span>
        <span className={`shrink-0 ${
          ok ? "chip chip-success" : muted ? "chip chip-neutral" : "chip chip-warn"
        }`}>{status}</span>
      </div>
      {href && hrefLabel && (
        <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}
          className="text-brand hover:text-brand-dim text-xs shrink-0 transition-colors">{hrefLabel}</a>
      )}
    </div>
  );
}
