import type { CheckContext, CheckResult, PilotCheck } from "../types";
import { githubClient } from "@/lib/github";

/** Vars the deploy step injects automatically. */
const INJECTED_AT_DEPLOY = new Set([
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]);
/** Vars the platform wires for every app (the user does nothing). */
const PLATFORM_PROVIDED = new Set(["RESEND_API_KEY", "RESEND_FROM_DOMAIN"]);
/** Keys that, if referenced but unset, will likely break the app (vs nice-to-haves). */
const CRITICAL_HINT = /SUPABASE|DATABASE|AUTH|SECRET_KEY/i;

function pass(): CheckResult {
  return {
    id: "env-readiness",
    title: "Live settings are wired up",
    severity: "pass",
    detail: "Your app's web address, database and email are all set for going live.",
    remedy: { kind: "none" },
    autoFixable: false,
  };
}

/**
 * Will the app boot in production, or 500 on missing config?
 *
 * Two deterministic signals: (1) the project has a database but Supabase is no
 * longer connected, so the deploy can't inject the DB keys → hard fail. (2) the
 * repo's .env.example lists critical-looking keys the platform won't set →
 * advisory warn. Everything optional is intentionally ignored to avoid noise.
 */
export const envReadinessCheck: PilotCheck = {
  id: "env-readiness",
  async run(ctx: CheckContext): Promise<CheckResult> {
    // (1) Hard case: needs a DB, but Supabase is disconnected.
    if (ctx.project.supabase_project_ref && !ctx.hasSupabaseConn) {
      return {
        id: "env-readiness",
        title: "Your app's database isn't connected",
        severity: "fail",
        detail:
          "Your app uses a database, but your Supabase connection is missing — so once it's live it won't be able to log anyone in or save data. Reconnect Supabase and it'll work.",
        remedy: { kind: "connect", provider: "supabase", href: "/api/supabase/oauth", label: "Connect Supabase" },
        autoFixable: false,
      };
    }

    // (2) Best-effort: read .env.example and flag critical-looking unset keys.
    if (ctx.githubToken && ctx.repoFullName) {
      try {
        const [owner, repo] = ctx.repoFullName.split("/");
        const gh = githubClient(ctx.githubToken);
        const res = await gh.repos.getContent({ owner, repo, path: ".env.example" });
        const data = res.data as { content?: string; encoding?: string };
        if (data?.content) {
          const text = Buffer.from(data.content, (data.encoding as BufferEncoding) || "base64").toString("utf8");
          const keys = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#") && l.includes("="))
            .map((l) => l.split("=")[0].trim())
            .filter(Boolean);
          const unset = keys.filter((k) => !INJECTED_AT_DEPLOY.has(k) && !PLATFORM_PROVIDED.has(k));
          const critical = unset.filter((k) => CRITICAL_HINT.test(k));
          if (critical.length) {
            return {
              id: "env-readiness",
              title: "Some required settings aren't set",
              severity: "warn",
              detail:
                `Your app expects these settings to run: ${critical.slice(0, 6).join(", ")}` +
                `${critical.length > 6 ? "…" : ""}. We set the core ones for you (web address, database, email) — these extra ones look important for your app to work.`,
              remedy: {
                kind: "prompt",
                label: "Copy a note for Claude/Codex",
                prompt:
                  `My Next.js app's .env.example lists these settings that aren't configured in production: ${critical.join(", ")}. ` +
                  `For each, tell me in plain English whether my app truly needs it to run, where I get the value, and where to put it. Skip any that are only for optional features.`,
              },
              autoFixable: false,
            };
          }
        }
      } catch {
        /* no .env.example, private, or unreadable — nothing to flag, fall through to pass */
      }
    }

    return pass();
  },
};
