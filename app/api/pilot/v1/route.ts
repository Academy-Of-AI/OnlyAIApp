import { NextResponse } from "next/server";
import { requireProApiCaller, recordApiUsage } from "@/lib/pilot/api/gate";
import { auditRepoFiles, healthScore, grade } from "@/lib/pilot/repo-audit";
import type { RepoFile } from "@/lib/pilot/repo-read";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Pilot API v1 — the hosted spine. The CLI (and a later MCP shim) are clients of
 * THIS. Every request passes the one gate (requireProApiCaller): bearer → Pro →
 * fair-use. The valuable logic (the drift rules) runs only here, server-side, so
 * the moat never ships to the client and billing stays continuous.
 *
 * GET  → verify a token: { ok, plan:"pro", usage }. Used by `pilot login`.
 * POST → run a tool: { tool, input } → { ok, tool, result, usage }.
 */

// Privacy-minimal input contract: the CLI sends only the rule-applicable files,
// never the whole repo. These caps keep a single call bounded.
const MAX_FILES = 80;
const MAX_FILE_CHARS = 64_000;
const MAX_TOTAL_CHARS = 2_000_000;

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

  if (tool === "drift_check") {
    const files = sanitizeFiles(input.files);
    if (!files.ok) return NextResponse.json({ ok: false, code: "bad_input", error: files.error }, { status: 400 });

    // The SAME deterministic engine the website's Repo Health uses (single source).
    const findings = auditRepoFiles(files.files);
    const score = healthScore(findings);
    const counts = {
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      total: findings.length,
    };

    await recordApiUsage(gate.admin, gate.userId, tool);
    const used = gate.used + 1;
    return NextResponse.json({
      ok: true,
      tool,
      result: { score, grade: grade(score), filesScanned: files.files.length, counts, findings },
      usage: { used, limit: gate.limit, remaining: Math.max(0, gate.limit - used) },
    });
  }

  return NextResponse.json({ ok: false, code: "unknown_tool", error: `Unknown tool "${tool}". Try "drift_check".` }, { status: 400 });
}

/** Validate the privacy-minimal file payload: [{ path, content }]. */
function sanitizeFiles(
  raw: unknown,
): { ok: true; files: RepoFile[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Expected input.files to be an array of { path, content }." };
  if (raw.length === 0) return { ok: false, error: "No files to scan." };
  if (raw.length > MAX_FILES) return { ok: false, error: `Too many files (${raw.length}); cap is ${MAX_FILES}. Send only the files the rules apply to.` };
  const files: RepoFile[] = [];
  let total = 0;
  for (const f of raw) {
    if (!f || typeof f !== "object") continue;
    const path = String((f as Record<string, unknown>).path ?? "");
    const content = String((f as Record<string, unknown>).content ?? "");
    if (!path || !content) continue;
    if (content.length > MAX_FILE_CHARS) continue; // skip oversized (vendored/minified)
    total += content.length;
    if (total > MAX_TOTAL_CHARS) return { ok: false, error: "Payload too large — send fewer/smaller files." };
    files.push({ path, content });
  }
  if (files.length === 0) return { ok: false, error: "No valid files to scan." };
  return { ok: true, files };
}
