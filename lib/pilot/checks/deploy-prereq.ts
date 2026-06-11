import type { CheckContext, CheckResult, PilotCheck } from "../types";
import { githubClient } from "@/lib/github";

/**
 * The deploy-prerequisite chain (drift #2).
 *
 * Going live is not one switch — it's a chain, and a break anywhere shows up as
 * a silent 404 or a "deployed" that never resolves. Two of the chain's links are
 * verifiable server-side BEFORE the user clicks deploy, and both bit us for real
 * in the alpha:
 *
 *   (1) Vercel disconnected mid-life — the project has a Vercel project id but
 *       the OAuth connection is gone, so a redeploy silently can't run.
 *   (2) The GitHub repo moved/renamed or our access lapsed — the half-done org
 *       move (`<user>/<repo>` → `Academy-Of-AI/<repo>`) left the stored repo URL
 *       pointing at a repo the token gets a 404/403 on, so Vercel can't build it.
 *
 * Both are advisory `warn`s with a plain-English fix (never block — the engine is
 * fail-open). Precision over recall: we only flag a repo we DEFINITELY can't read
 * (404/403), not a transient network blip.
 */
export const deployPrereqCheck: PilotCheck = {
  id: "deploy-prereq",
  async run(ctx: CheckContext): Promise<CheckResult> {
    // (1) Has a Vercel project but lost the Vercel connection → redeploy can't run.
    if (ctx.project.vercel_project_id && !ctx.hasVercelConn) {
      return {
        id: "deploy-prereq",
        title: "Your Vercel connection is missing",
        severity: "warn",
        detail:
          "This app is set up on Vercel, but your Vercel connection has dropped — so we can't push a new version live until you reconnect it. Your existing live app keeps running; reconnecting takes one click.",
        remedy: { kind: "connect", provider: "vercel", href: "/api/vercel/oauth", label: "Reconnect Vercel" },
        autoFixable: false,
      };
    }

    // (2) The linked GitHub repo isn't reachable with the user's token (moved,
    // renamed, or access lapsed) → Vercel can't build it. Verifiable: a single
    // repos.get. A 404/403 is a definite break; anything else, stay quiet.
    if (ctx.githubToken && ctx.repoFullName) {
      const [owner, repo] = ctx.repoFullName.split("/");
      if (owner && repo) {
        try {
          await githubClient(ctx.githubToken).repos.get({ owner, repo });
        } catch (e) {
          const status = (e as { status?: number })?.status;
          if (status === 404 || status === 403) {
            return {
              id: "deploy-prereq",
              title: "We can't reach your app's code on GitHub",
              severity: "warn",
              detail:
                `The repo this app points to (${ctx.repoFullName}) can't be opened with your GitHub connection — it may have been renamed, moved to another account/org, or had its access changed. Vercel builds from this repo, so a deploy will fail until the link is fixed.`,
              remedy: {
                kind: "prompt",
                label: "Copy a note for Claude/Codex",
                prompt:
                  `My deploy points at the GitHub repo "${ctx.repoFullName}" but the platform gets a ${status} opening it. ` +
                  `Help me check: was the repo renamed or moved to a different owner/org? Is my GitHub connection still authorized for it? ` +
                  `Tell me how to either restore access or update the repo link so deploys work again.`,
              },
              autoFixable: false,
            };
          }
          // any other error (rate limit, network) — don't cry wolf, fall through
        }
      }
    }

    return {
      id: "deploy-prereq",
      title: "Deploy path is clear",
      severity: "pass",
      detail: "Your code and hosting are connected and reachable — the deploy can run.",
      remedy: { kind: "none" },
      autoFixable: false,
    };
  },
};
