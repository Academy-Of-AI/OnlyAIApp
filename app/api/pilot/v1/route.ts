import { NextResponse } from "next/server";
import { requireProApiCaller, recordApiUsage } from "@/lib/pilot/api/gate";
import { currentApiPeriod } from "@/lib/plan";

export const runtime = "nodejs";

/**
 * Pilot API v1 — the hosted spine. The CLI runs the drift checks LOCALLY (code
 * never leaves the user's machine) and calls THIS to (1) verify entitlement
 * (gate: bearer → Pro → fair-use, = continuous billing) and (2) report an
 * anonymous failure fingerprint for fleet learning. There is deliberately NO
 * endpoint that accepts source code — privacy by construction.
 *
 * GET  → verify a token: { ok, plan, usage }. Used by `pilot login`.
 * POST → { tool:"report", input:<pattern> } → records the (enum-only) signal.
 */

const SEVERITY = new Set(["high", "medium", "low"]);
const FILE_KIND = new Set(["route", "component", "lib", "action", "other"]);
const OUTCOME = new Set(["new", "persisted", "fixed", "suppressed"]);
const MAX_FINDINGS = 200;

export async function GET(req: Request) {
  const gate = await requireProApiCaller(req);
  if (!gate.ok) return NextResponse.json({ ok: false, code: gate.code, error: gate.message }, { status: gate.status });
  return NextResponse.json({
    ok: true,
    plan: "pro",
    usage: { used: gate.used, limit: gate.limit, remaining: Math.max(0, gate.limit - gate.used) },
  });
}

export async function POST(req: Request) {
  const gate = await requireProApiCaller(req);
  if (!gate.ok) return NextResponse.json({ ok: false, code: gate.code, error: gate.message }, { status: gate.status });

  const body = (await req.json().catch(() => ({}))) as { tool?: unknown; input?: unknown };
  const tool = String(body.tool ?? "");
  const input = (body.input && typeof body.input === "object" ? body.input : {}) as Record<string, unknown>;

  if (tool === "report") {
    // Every call counts toward fair-use (continuous billing), findings or not.
    await recordApiUsage(gate.admin, gate.userId, "report");

    // Persist the fleet signal ONLY from the enum-only fields — anything that
    // could carry code (paths, source lines, content) is structurally absent
    // from this shape and never read, so it can't be stored even if sent.
    const rows = sanitizeReport(input).map((f) => ({
      user_id: gate.userId,
      anon_repo_id: typeof input.anonRepoId === "string" ? input.anonRepoId.slice(0, 128) : null,
      rule_id: f.ruleId,
      drift_class: f.drift,
      severity: f.severity,
      file_kind: f.fileKind,
      outcome: f.outcome,
      stack_tags: sanitizeTags(input.stackTags),
      period: currentApiPeriod(),
    }));
    if (rows.length) {
      try { await gate.admin.from("pilot_signals").insert(rows); } catch { /* non-fatal — never fail the user's check */ }
    }

    const used = gate.used + 1;
    return NextResponse.json({
      ok: true,
      tool: "report",
      recorded: rows.length,
      usage: { used, limit: gate.limit, remaining: Math.max(0, gate.limit - used) },
    });
  }

  return NextResponse.json({ ok: false, code: "unknown_tool", error: `Unknown tool "${tool}". This API records check reports; run \`pilot check\` (the CLI runs the checks locally).` }, { status: 400 });
}

/** Keep ONLY the enum/short-string fields from each reported finding. Drops
 *  anything unexpected (incl. any accidental code/path field). */
function sanitizeReport(input: Record<string, unknown>) {
  const raw = Array.isArray(input.findings) ? input.findings.slice(0, MAX_FINDINGS) : [];
  const out: { ruleId: string; drift: string; severity: string; fileKind: string; outcome: string }[] = [];
  for (const f of raw) {
    if (!f || typeof f !== "object") continue;
    const r = f as Record<string, unknown>;
    const ruleId = String(r.ruleId ?? "").slice(0, 64);
    const drift = String(r.drift ?? "").slice(0, 48);
    const severity = String(r.severity ?? "");
    const fileKind = String(r.fileKind ?? "other");
    const outcome = String(r.outcome ?? "new");
    if (!ruleId || !SEVERITY.has(severity)) continue;
    out.push({
      ruleId, drift, severity,
      fileKind: FILE_KIND.has(fileKind) ? fileKind : "other",
      outcome: OUTCOME.has(outcome) ? outcome : "new",
    });
  }
  return out;
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t) => typeof t === "string").slice(0, 20).map((t) => String(t).slice(0, 24));
}
