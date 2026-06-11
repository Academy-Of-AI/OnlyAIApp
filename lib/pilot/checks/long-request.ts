import type { CheckContext, CheckResult, PilotCheck } from "../types";
import { githubClient } from "@/lib/github";

/**
 * The 5-minute trap. Vercel kills any serverless function that runs longer than
 * 300s. Long synchronous work inside a request (an AI call, emailing a big list)
 * fails on large inputs. We scan the app's server routes/actions for the
 * high-precision signals and warn (never block) when one looks at risk.
 *
 * Precision over recall on purpose: a false positive here is exactly the kind of
 * annoyance that erodes trust, so we only flag an AI-SDK call, OR an email-send
 * inside a loop, AND no `maxDuration`, AND no streaming. Advisory only.
 */
const MAX_FILES = 12;
const FILE_RE = /(^app\/api\/.*route\.ts$)|(actions\.ts$)/;

const AI_SDK = /@anthropic-ai\/sdk|from\s+['"]openai['"]|from\s+['"]ai['"]|generateText|streamText|messages\.create/;
const EMAIL_SEND = /\.emails\.send|sendEmail|sendMail|resend\./i;
const LOOP = /\bfor\s*\(|\bwhile\s*\(|\.map\(|\.forEach\(/;
const HAS_MAXDUR = /export\s+const\s+maxDuration/;
const STREAMS = /ReadableStream|StreamingTextResponse|toDataStreamResponse|toTextStreamResponse/;

function short(p: string) {
  return p.replace(/^app\//, "").replace(/\/route\.ts$/, "").replace(/\.ts$/, "");
}
function pass(): CheckResult {
  return {
    id: "long-request",
    title: "No long-running jobs found",
    severity: "pass",
    detail: "Nothing in your app looks like it'll hit the 5-minute limit.",
    remedy: { kind: "none" },
    autoFixable: false,
  };
}
function skip(reason: string): CheckResult {
  return {
    id: "long-request",
    title: "Timeout check skipped",
    severity: "skipped",
    detail: reason,
    remedy: { kind: "none" },
    autoFixable: false,
    skipReason: reason,
  };
}

export const longRequestCheck: PilotCheck = {
  id: "long-request",
  async run(ctx: CheckContext): Promise<CheckResult> {
    if (!ctx.githubToken || !ctx.repoFullName) return skip("No GitHub access to scan the app.");
    const [owner, repo] = ctx.repoFullName.split("/");
    const gh = githubClient(ctx.githubToken);

    let paths: string[] = [];
    try {
      const meta = await gh.repos.get({ owner, repo });
      const branch = meta.data.default_branch || "main";
      const tree = await gh.git.getTree({ owner, repo, tree_sha: branch, recursive: "true" });
      paths = (tree.data.tree || [])
        .filter((n) => n.type === "blob" && typeof n.path === "string" && FILE_RE.test(n.path))
        .map((n) => n.path as string)
        .slice(0, MAX_FILES);
    } catch {
      return skip("Couldn't list the app's files.");
    }
    if (!paths.length) return pass();

    const flagged: string[] = [];
    await Promise.all(
      paths.map(async (path) => {
        try {
          const res = await gh.repos.getContent({ owner, repo, path });
          const d = res.data as { content?: string; encoding?: string };
          if (!d?.content) return;
          const code = Buffer.from(d.content, (d.encoding as BufferEncoding) || "base64").toString("utf8");
          const heavy = AI_SDK.test(code) || (EMAIL_SEND.test(code) && LOOP.test(code));
          if (heavy && !HAS_MAXDUR.test(code) && !STREAMS.test(code)) flagged.push(path);
        } catch {
          /* unreadable file — skip it */
        }
      }),
    );

    if (!flagged.length) return pass();

    return {
      id: "long-request",
      title: "One job might run too long and fail",
      severity: "warn",
      detail:
        "Some of your app's actions do heavy work (like calling AI or emailing a big list) while the page waits. Your host stops anything running longer than 5 minutes, so on large inputs these can fail. Affected: " +
        flagged.map(short).join(", ") +
        ".",
      remedy: {
        kind: "prompt",
        label: "Copy fix for Claude/Codex",
        prompt:
          "In my Next.js app deployed on Vercel, these server files run long synchronous work inside the request and will hit Vercel's 5-minute function limit on large inputs: " +
          flagged.join(", ") +
          ". Refactor each so the heavy work runs as a background job (or is streamed/paginated) and the request returns immediately with a progress indicator the user can poll. Keep the existing behaviour and UI; only move the long work off the request path.",
      },
      autoFixable: false,
    };
  },
};
