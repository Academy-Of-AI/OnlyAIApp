import Anthropic from "@anthropic-ai/sdk";
import { friendlyAiError } from "@/lib/ai-errors";

/**
 * The plain-English diagnosis we hand the builder for a failed deploy/build:
 * what broke (no jargon), the ONE next step, and a paste-ready prompt they can
 * drop into their coding agent (Claude Code / Codex) to fix it.
 */
export interface ErrorExplanation {
  whatBroke: string;
  nextStep: string;
  fixPrompt: string;
}

// Deliberately NOT BUILD_MODEL: explain-error is free-allowed and runs on the
// owner key, so it must stay on a cheap model even when BUILD_MODEL is set to a
// Sonnet/Opus-class override for plan generation. Override via EXPLAIN_MODEL only.
const EXPLAIN_MODEL = process.env.EXPLAIN_MODEL ?? "claude-haiku-4-5";

/** Strip ANSI colour codes + carriage returns so heuristics + the LLM see clean text. */
function clean(errorText: string): string {
  return (errorText || "")
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, "") // ESC-prefixed ANSI colour codes
    .replace(/\[[0-9;]*m/g, "") // bare bracket form (some logs strip the ESC byte)
    .replace(/\r/g, "")
    .trim();
}

/** Pull the first file path we can see (e.g. "app/page.tsx") so the fix prompt is specific. */
function firstFilePath(text: string): string | null {
  const m = text.match(/(?:\.\/)?((?:src\/|app\/|lib\/|components\/|pages\/)?[\w./-]+\.(?:tsx?|jsx?|mjs|cjs|css|json))(?::\d+)?/);
  return m ? m[1] : null;
}

/** Pull a missing module/package name from a "Cannot find module 'x'" style error. */
function missingModule(text: string): string | null {
  const m =
    text.match(/Cannot find module ['"]([^'"]+)['"]/i) ||
    text.match(/Module not found:.*?['"]([^'"]+)['"]/i) ||
    text.match(/Can't resolve ['"]([^'"]+)['"]/i);
  return m ? m[1] : null;
}

/** Pull a missing env-var name from common "missing env" phrasings. */
function missingEnvVar(text: string): string | null {
  const m =
    text.match(/(?:env(?:ironment)?\s*variable|missing\s+env|process\.env\.)\s*["'`]?([A-Z][A-Z0-9_]{2,})["'`]?/i) ||
    text.match(/([A-Z][A-Z0-9_]{2,})\s+is\s+(?:not\s+(?:defined|set)|missing|required|undefined)/);
  if (m && m[1]) return m[1];
  // "supabaseUrl/Key is required" -> map to the public env var the builder actually sets.
  if (/supabaseUrl\s+is\s+required/i.test(text)) return "NEXT_PUBLIC_SUPABASE_URL";
  if (/supabaseKey\s+is\s+required/i.test(text)) return "NEXT_PUBLIC_SUPABASE_ANON_KEY";
  return null;
}

/** A one-line snippet of the raw error for the fix prompt (kept short + safe). */
function errorSnippet(text: string): string {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /error|cannot|not found|failed|required|missing|undefined/i.test(l));
  return (line ?? text.split("\n")[0] ?? "").slice(0, 240);
}

/**
 * FAST heuristic pass for the common deploy failures — no LLM, instant + free.
 * Returns null when nothing matches (then we fall back to the model).
 */
function heuristicExplain(text: string): ErrorExplanation | null {
  const file = firstFilePath(text);
  const at = file ? ` in \`${file}\`` : "";
  const snippet = errorSnippet(text);

  // 1) Vercel "commit email could not be matched to a GitHub account"
  if (/commit author email .*could not be matched|could not be matched to a GitHub account|commit email/i.test(text)) {
    return {
      whatBroke:
        "Vercel rejected the deploy because the email on your last commit isn't linked to your GitHub account. Nothing is wrong with your code — it's just an identity mismatch.",
      nextStep:
        "Set this repo's git email to one on your GitHub account, then make any commit and push again.",
      fixPrompt:
        "Vercel blocked my deploy with \"commit author email could not be matched to a GitHub account.\" " +
        "Set git to use my GitHub-verified email in this repo (git config user.email \"<my GitHub email>\" and user.name), " +
        "then make an empty/trivial commit and push to main so a fresh deploy runs.",
    };
  }

  // 2) Missing module / dependency not installed
  const mod = missingModule(text);
  if (mod) {
    const isLocal = mod.startsWith(".") || mod.startsWith("/") || mod.startsWith("@/");
    return {
      whatBroke: isLocal
        ? `The build can't find a file your code imports: \`${mod}\`. The import path is probably wrong, or the file wasn't committed.`
        : `The build can't find the package \`${mod}\`. It's used in your code but isn't installed (missing from package.json), so the build fails.`,
      nextStep: isLocal
        ? `Fix the import path for \`${mod}\` (or commit the missing file), then push.`
        : `Add \`${mod}\` to your dependencies (\`npm install ${mod}\`), commit package.json + the lockfile, and push.`,
      fixPrompt: isLocal
        ? `My Vercel build fails with "Cannot find module '${mod}'"${at}. Find the broken import, correct the path (or create/commit the missing file), verify it builds, then commit & push.`
        : `My Vercel build fails with "Cannot find module '${mod}'". Install ${mod} (npm install ${mod}), make sure it's saved in package.json and the lockfile, verify the build passes, then commit & push.`,
    };
  }

  // 3) Missing environment variable
  const envVar = missingEnvVar(text);
  if (envVar) {
    return {
      whatBroke: `Your app needs the environment variable \`${envVar}\`, but it isn't set in this project — so the build (or the app at startup) can't read it.`,
      nextStep: `Add \`${envVar}\` in Vercel → Project → Settings → Environment Variables, then redeploy.`,
      fixPrompt:
        `My deploy fails because the environment variable ${envVar} is missing. ` +
        `Tell me exactly what value ${envVar} should have and where to get it, then remind me to add it in Vercel's Environment Variables and redeploy. ` +
        `Also check the code reads it safely so a missing value gives a clear message instead of crashing the build.`,
    };
  }

  // 4) TypeScript type error
  if (/Type error:|TS\d{3,}|is not assignable to type|Property '.*' does not exist/i.test(text)) {
    return {
      whatBroke: `There's a TypeScript type mismatch${at}: the code uses a value in a way its type doesn't allow, so the build stops. (${snippet})`,
      nextStep: file
        ? `Open \`${file}\` and fix the flagged type, then commit & push.`
        : "Fix the flagged type mismatch, then commit & push.",
      fixPrompt:
        `My Vercel build fails with a TypeScript type error${at}: "${snippet}". ` +
        `Fix the type error properly (correct the types — don't just cast to any or add @ts-ignore), make sure \`npm run build\` passes, then commit & push.`,
    };
  }

  // 5) ESLint failure blocking the build
  if (/ESLint|eslint|@typescript-eslint\//i.test(text) && /lint/i.test(text)) {
    return {
      whatBroke: `An ESLint rule failed${at}, and the build treats lint errors as blockers — so the deploy stops even though the app may run fine. (${snippet})`,
      nextStep: file
        ? `Fix the lint error in \`${file}\` (or relax that rule), then commit & push.`
        : "Fix the reported lint error, then commit & push.",
      fixPrompt:
        `My Vercel build fails on an ESLint error${at}: "${snippet}". ` +
        `Fix the underlying issue cleanly (don't blanket-disable linting). If it's a false positive, disable just that one rule for that line with a comment. Then verify the build passes and commit & push.`,
    };
  }

  // 6) Build timeout / out-of-memory
  if (/JavaScript heap out of memory|out of memory|ENOMEM|Killed|exceeded the maximum|build exceeded|timed? out|FATAL ERROR: .*heap/i.test(text)) {
    const oom = /heap|memory|ENOMEM|Killed/i.test(text);
    return {
      whatBroke: oom
        ? "The build ran out of memory and was killed before it could finish — usually something is pulling in far more than it needs (a huge import, a heavy build step, or an accidental loop)."
        : "The build took too long and Vercel cut it off before it finished.",
      nextStep: oom
        ? "Trim what the build loads (remove heavy/unused imports or split the big step), then push and watch the build."
        : "Find the slow step and speed it up (or remove it), then push again.",
      fixPrompt: oom
        ? "My Vercel build is failing with a JavaScript heap out-of-memory error. Investigate what's blowing up memory at build time (huge dependencies, large data imported at build, a runaway loop), reduce it, confirm the build passes, then commit & push."
        : "My Vercel build is timing out before it finishes. Find the slowest part of the build and make it faster or remove it, confirm the build passes locally, then commit & push.",
    };
  }

  // 7) Generic "Failed to compile" with no more specific signal
  if (/Failed to compile|Build failed|Command .* exited with \d+/i.test(text)) {
    return {
      whatBroke: `The build failed to compile${at}. The first thing it complained about was: "${snippet}".`,
      nextStep: file
        ? `Open \`${file}\` and fix the first error above, then commit & push.`
        : "Fix the first error shown in the build log, then commit & push.",
      fixPrompt:
        `My Vercel build is failing to compile${at}. The error is: "${snippet}". ` +
        `Find the root cause, fix it properly, make sure \`npm run build\` passes locally, then commit & push.`,
    };
  }

  return null;
}

/** A last-resort, never-throws fallback when even the LLM is unavailable. */
function safeFallback(text: string): ErrorExplanation {
  const file = firstFilePath(text);
  const snippet = errorSnippet(text);
  return {
    whatBroke: snippet
      ? `Your last deploy failed. The build log's key line was: "${snippet}". It's almost always one small fix.`
      : "Your last deploy failed during the build. It's almost always one small fix — the build log has the specific line.",
    nextStep: file
      ? `Open \`${file}\`, fix the issue the build log points at, then commit & push.`
      : "Open the Vercel build log, find the first red error line, fix that one thing, then commit & push.",
    fixPrompt:
      `My Vercel deploy failed. Here's the error from the build log:\n\n"${snippet || text.slice(0, 240)}"\n\n` +
      `Diagnose the root cause, fix it, make sure \`npm run build\` passes locally, then commit & push.`,
  };
}

/**
 * Turn a scary deploy/build error into a calm, plain-English diagnosis + the ONE
 * next step + a paste-ready fix prompt for the builder's coding agent.
 *
 * Strategy: try the fast regex heuristics first (instant + free for the common
 * cases). Only unknown errors hit the cheap LLM. ALWAYS returns something — on
 * any AI failure it degrades to a safe, generic-but-actionable explanation.
 * Never throws.
 */
export async function explainDeployError(errorText: string): Promise<ErrorExplanation> {
  const text = clean(errorText);
  if (!text) {
    return {
      whatBroke: "The last deploy failed, but no error detail came back from the build log.",
      nextStep: "Open the Vercel build log for this project, find the first red error line, then fix that one thing and push.",
      fixPrompt:
        "My Vercel deploy failed but I can't see a clear error. Open the latest build log, find the first error, explain it in plain English, fix it, confirm the build passes, then commit & push.",
    };
  }

  // 1) Fast path — common cases, no LLM.
  const heuristic = heuristicExplain(text);
  if (heuristic) return heuristic;

  // 2) Unknown error — ask the cheap model for the same 3 fields (JSON).
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_SECRET_KEY;
  if (!apiKey) return safeFallback(text);

  try {
    const anthropic = new Anthropic({ apiKey });
    const prompt =
      "You help a NON-TECHNICAL builder whose Vercel/Next.js deploy just failed. " +
      "Given the raw build error, respond ONLY with a JSON object (no markdown, no prose) with exactly these keys:\n" +
      '{ "whatBroke": string, "nextStep": string, "fixPrompt": string }\n\n' +
      "- whatBroke: 1-2 calm, plain-English sentences. No jargon, no stack traces. Reassuring — it's one fixable thing.\n" +
      "- nextStep: ONE concrete action they (or their agent) should take next. Imperative, single step.\n" +
      "- fixPrompt: a ready-to-paste instruction for their coding agent (Claude Code / Codex). Reference the specific file/error, " +
      "and end by telling it to verify the build passes then commit & push. Keep it under 80 words.\n" +
      "Never include secrets, tokens, or raw JSON from the log.\n\n" +
      "Raw build error:\n```\n" +
      text.slice(0, 4000) +
      "\n```";

    const resp = await anthropic.messages.create({
      model: EXPLAIN_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = resp.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<ErrorExplanation>;
      if (parsed.whatBroke && parsed.nextStep && parsed.fixPrompt) {
        return {
          whatBroke: String(parsed.whatBroke).slice(0, 600),
          nextStep: String(parsed.nextStep).slice(0, 400),
          fixPrompt: String(parsed.fixPrompt).slice(0, 800),
        };
      }
    }
    // Model returned something unusable — degrade gracefully.
    return safeFallback(text);
  } catch (err) {
    // Never leak raw AI/SDK errors. friendlyAiError gives a safe note; either way
    // we still hand back an actionable fallback so the user is never stuck.
    const friendly = friendlyAiError(err);
    const fallback = safeFallback(text);
    if (friendly) {
      return { ...fallback, nextStep: `${fallback.nextStep} (AI auto-diagnosis is paused: ${friendly})` };
    }
    return fallback;
  }
}
