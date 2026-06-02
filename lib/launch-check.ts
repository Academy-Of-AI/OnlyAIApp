import { getLatestDeploymentStatus } from "@/lib/vercel";

/**
 * Launch-readiness checks. Deterministic, backend-run: we inspect the member's
 * live deployment + fetch the live page and look for the things that separate
 * "it built" from "it's actually launched." Each failing check carries a plain-
 * English fix AND a ready-to-paste Claude Code task — the member drives their
 * own agent to fix it (OnlyAIApp says what to ask).
 */

export type CheckStatus = "pass" | "fail" | "warn" | "unknown";

export interface LaunchCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** A ready-to-paste task for the member's Claude Code (only when not passing). */
  claudeTask?: string;
}

export async function runLaunchChecks(opts: {
  url: string | null;
  vercelToken?: string | null;
  vercelProjectId?: string | null;
  vercelTeamId?: string | null;
}): Promise<LaunchCheck[]> {
  const { url, vercelToken, vercelProjectId, vercelTeamId } = opts;
  const checks: LaunchCheck[] = [];

  /* 1 — deploy actually built */
  if (vercelToken && vercelProjectId) {
    const s = await getLatestDeploymentStatus({
      token: vercelToken,
      projectId: vercelProjectId,
      teamId: vercelTeamId ?? undefined,
    });
    checks.push({
      id: "deploy",
      label: "Latest deploy is live",
      status: s.state === "READY" ? "pass" : s.state === "ERROR" ? "fail" : "warn",
      detail:
        s.state === "READY" ? "Your latest deploy built and is live."
        : s.state === "ERROR" ? "Your latest deploy FAILED to build — the live site is stale or broken."
        : `Deploy state: ${s.state}.`,
      claudeTask: s.state === "ERROR"
        ? "My latest Vercel deploy failed to build. Open the Vercel build logs, find the error, and fix the root cause so the project deploys cleanly."
        : undefined,
    });
  }

  /* 2-5 — fetch the live page and inspect it */
  if (url) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      const html = await res.text();

      checks.push({
        id: "reachable",
        label: "Site loads",
        status: res.ok ? "pass" : "fail",
        detail: res.ok ? `Homepage responds (${res.status}).` : `Homepage returned ${res.status}.`,
        claudeTask: res.ok ? undefined
          : "My deployed homepage returns an error instead of loading. Diagnose why and fix it so the page renders.",
      });

      const hasTitle = /<title>[^<]{3,}<\/title>/i.test(html);
      checks.push({
        id: "title",
        label: "Has a page title",
        status: hasTitle ? "pass" : "fail",
        detail: hasTitle ? "A <title> tag is present." : "No real <title> — bad for the browser tab and search.",
        claudeTask: hasTitle ? undefined
          : 'Add a clear page <title> and a <meta name="description"> via the Next.js metadata export in app/layout.tsx.',
      });

      const hasDesc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}/i.test(html);
      checks.push({
        id: "description",
        label: "Has a meta description + social preview",
        status: hasDesc ? "pass" : "warn",
        detail: hasDesc ? "A meta description is present." : "No meta description — weak search results and ugly link previews.",
        claudeTask: hasDesc ? undefined
          : "Add a meta description plus Open Graph and Twitter card tags to the site metadata so shared links preview nicely.",
      });

      const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
      checks.push({
        id: "mobile",
        label: "Mobile-ready (viewport set)",
        status: hasViewport ? "pass" : "fail",
        detail: hasViewport ? "A responsive viewport meta tag is present." : "No viewport meta — the site won't scale on phones.",
        claudeTask: hasViewport ? undefined
          : 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> and make the homepage mobile-friendly: no horizontal scroll under 380px, tap targets >= 44px, inputs >= 16px.',
      });
    } catch {
      checks.push({
        id: "reachable",
        label: "Site loads",
        status: "fail",
        detail: "Couldn't reach the live site.",
        claudeTask: "My deployed site isn't reachable. Diagnose the deployment and fix it so the homepage loads.",
      });
    }
  } else {
    checks.push({
      id: "url",
      label: "Has a live URL",
      status: "fail",
      detail: "No live URL yet — finish provisioning / deploy first.",
    });
  }

  /* 6 — custom domain (vs the default *.vercel.app) */
  if (url) {
    const custom = !/\.vercel\.app/i.test(url);
    checks.push({
      id: "domain",
      label: "On a custom domain",
      status: custom ? "pass" : "warn",
      detail: custom ? "Running on a custom domain." : "Still on the default .vercel.app URL — add your own domain for launch.",
    });
  }

  return checks;
}
