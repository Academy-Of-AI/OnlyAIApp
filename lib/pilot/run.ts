import type { CheckContext, CheckResult, PilotCheck } from "./types";
import { envReadinessCheck } from "./checks/env-readiness";
import { longRequestCheck } from "./checks/long-request";

/**
 * The Pilot checks engine.
 *
 * Registry of checks (add a trap = add a file + one line here). runPilotChecks
 * runs them all in parallel and NEVER throws: each check is wrapped in its own
 * try/catch + a hard timeout, so a broken or slow check degrades to `skipped`
 * and can never block a user's deploy (fail-open). This is the deterministic
 * spine; Pilot (the conversational/Pro layer) sits on top of these results.
 */
const REGISTRY: PilotCheck[] = [envReadinessCheck, longRequestCheck];

const PER_CHECK_TIMEOUT_MS = 9000;

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const t = setTimeout(() => { if (!settled) { settled = true; resolve(onTimeout()); } }, ms);
    p.then((v) => { if (!settled) { settled = true; clearTimeout(t); resolve(v); } })
     .catch(() => { if (!settled) { settled = true; clearTimeout(t); resolve(onTimeout()); } });
  });
}

export async function runPilotChecks(ctx: CheckContext): Promise<CheckResult[]> {
  return Promise.all(
    REGISTRY.map((c) =>
      withTimeout(
        c.run(ctx).catch((e): CheckResult => ({
          id: c.id,
          title: "Check skipped",
          severity: "skipped",
          detail: "This check couldn't run just now — going live is still allowed.",
          remedy: { kind: "none" },
          autoFixable: false,
          skipReason: (e as Error)?.message ?? "error",
        })),
        PER_CHECK_TIMEOUT_MS,
        (): CheckResult => ({
          id: c.id,
          title: "Check skipped",
          severity: "skipped",
          detail: "This check took too long and was skipped — going live is still allowed.",
          remedy: { kind: "none" },
          autoFixable: false,
          skipReason: "timeout",
        }),
      ),
    ),
  );
}

/** Should the UI pause go-live to show the cards? Only true findings count —
 *  `skipped` never blocks. */
export function isBlocking(results: CheckResult[]): boolean {
  return results.some((r) => r.severity === "warn" || r.severity === "fail");
}
