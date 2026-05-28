/**
 * Renders a project's persistent memory + plan-of-record into a CLAUDE.md.
 * Claude Code reads CLAUDE.md natively at the repo root, so this is how the
 * control plane feeds objective, decisions, and guardrails straight into the
 * agent — no agent-internals hacking required.
 */

export interface MemoryEntry { kind: string; content: string }
export interface Milestone { title: string; status: string; detail?: string | null }

const KIND_HEADINGS: Record<string, string> = {
  objective: "Objective",
  decision: "Decisions",
  architecture: "Architecture",
  gotcha: "Gotchas",
  note: "Notes",
};

export function renderClaudeMd({
  projectName,
  objective,
  milestones,
  memory,
}: {
  projectName: string;
  objective?: string | null;
  milestones?: Milestone[];
  memory?: MemoryEntry[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${projectName}`, "");
  lines.push("<!-- Managed by Launchpad. Edits here may be overwritten on next sync. -->", "");

  if (objective) {
    lines.push("## Objective", "", objective.trim(), "");
    lines.push(
      "Stay on this objective. Before adding anything not in service of it, flag it as scope creep rather than silently building it.",
      "",
    );
  }

  if (milestones && milestones.length) {
    lines.push("## Plan of record", "");
    const current = milestones.find((m) => m.status === "in_progress");
    if (current) lines.push(`**Current milestone:** ${current.title}`, "");
    for (const m of milestones) {
      const box = m.status === "done" ? "[x]" : m.status === "in_progress" ? "[~]" : "[ ]";
      lines.push(`- ${box} ${m.title}${m.detail ? ` — ${m.detail}` : ""}`);
    }
    lines.push("");
  }

  if (memory && memory.length) {
    const byKind = new Map<string, string[]>();
    for (const e of memory) {
      if (e.kind === "objective") continue; // already rendered above
      const arr = byKind.get(e.kind) ?? [];
      arr.push(e.content.trim());
      byKind.set(e.kind, arr);
    }
    for (const kind of ["decision", "architecture", "gotcha", "note"]) {
      const arr = byKind.get(kind);
      if (!arr?.length) continue;
      lines.push(`## ${KIND_HEADINGS[kind] ?? kind}`, "");
      for (const c of arr) lines.push(`- ${c}`);
      lines.push("");
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
