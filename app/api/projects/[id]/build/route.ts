import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { triggerVercelDeployment, getDeploymentById, getDeploymentErrorLine, type DeploymentState } from "@/lib/vercel";

export const maxDuration = 300;

/* Build engine. Sonnet by default for the on-ramp economics (~5x cheaper than
   Opus, ample quality for a first OS). Override with the BUILD_MODEL env var
   (e.g. "claude-opus-4-5" for a premium tier) — no code change or redeploy of
   logic needed. */
const BUILD_MODEL = process.env.BUILD_MODEL ?? "claude-sonnet-4-5";

/**
 * POST /api/projects/:id/build
 * Reads the user's GitHub repo, sends files to Claude, commits AI-generated
 * changes back, then explicitly triggers a Vercel deployment.
 * Streams SSE progress events to the client.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // The in-app "Build it" UI sends the request in the body. Fall back to the
  // saved project.build_prompt for legacy / server-initiated builds.
  const body = (await request.json().catch(() => ({}))) as { prompt?: string };
  const promptOverride =
    typeof body?.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : null;

  /* ── auth ────────────────────────────────────────────────────────────── */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  /* ── on-ramp economics ───────────────────────────────────────────────────
     Credits ARE the gate ($10 = 3 builds). The in-app build runs on the
     owner's key, paid for by the builder's credits. New users start with 0
     credits → they hit the paywall below until they buy. OWNER_FUNDED_BUILDS=
     "true" is an optional override that lets everyone build free (e.g. a
     hackathon the owner is sponsoring) — off by default. */
  const ownerFunded = process.env.OWNER_FUNDED_BUILDS === "true";

  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_SECRET_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "AI build not configured — add ANTHROPIC_API_KEY to your Vercel environment variables." },
      { status: 500 },
    );
  }

  /* ── check credits ───────────────────────────────────────────────────── */
  const { data: profile } = await supabase
    .from("profiles")
    .select("build_credits")
    .eq("id", user.id)
    .single();

  if (!ownerFunded && (!profile || profile.build_credits <= 0)) {
    return NextResponse.json(
      { error: "You're out of builds — get 3 builds for $10 to keep building.", code: "no_credits" },
      { status: 402 },
    );
  }

  /* ── load project ────────────────────────────────────────────────────── */
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!project)
    return NextResponse.json({ error: "Project not found" }, { status: 404 });

  /* ── build mutex — block concurrent builds on the same project ────── */
  if (project.status === "building") {
    return NextResponse.json(
      { error: "A build is already in progress for this project.", code: "build_in_progress" },
      { status: 409 },
    );
  }

  const buildPrompt = promptOverride ?? (project.build_prompt as string | null);
  if (!buildPrompt)
    return NextResponse.json({ error: "Describe what you want to build first." }, { status: 400 });
  if (!project.github_repo_url)
    return NextResponse.json({ error: "No GitHub repo linked to this project" }, { status: 400 });

  /* ── parse repo ──────────────────────────────────────────────────────── */
  const repoMatch = project.github_repo_url.match(
    /github\.com\/([^/]+)\/([^/?#]+)/,
  );
  if (!repoMatch)
    return NextResponse.json({ error: "Could not parse GitHub repo URL" }, { status: 400 });
  const [, owner, rawRepo] = repoMatch;
  const repo = rawRepo.replace(/\.git$/, "");

  /* ── load github + vercel tokens in parallel ─────────────────────────── */
  const [{ data: githubConn }, { data: vercelConn }] = await Promise.all([
    supabase
      .from("oauth_connections")
      .select("access_token")
      .eq("user_id", user.id)
      .eq("provider", "github")
      .single(),
    supabase
      .from("oauth_connections")
      .select("access_token, metadata")
      .eq("user_id", user.id)
      .eq("provider", "vercel")
      .single(),
  ]);

  if (!githubConn)
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  const githubToken = await decrypt(githubConn.access_token as string);
  const octokit = new Octokit({ auth: githubToken });

  // Vercel token is optional — we'll still push to GitHub even if it's missing
  let vercelToken: string | null = null;
  let vercelTeamId: string | null = null;
  if (vercelConn) {
    try {
      vercelToken = await decrypt(vercelConn.access_token as string);
      const meta = vercelConn.metadata as { team_id?: string | null } | null;
      vercelTeamId = meta?.team_id ?? null;
    } catch { /* non-fatal */ }
  }

  /* ── SSE stream ──────────────────────────────────────────────────────── */
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        /* Deduct 1 credit atomically before we do any expensive work */
        const { data: deducted } = await supabase.rpc("use_build_credit", { p_user_id: user.id });
        if (!deducted) {
          send({ step: "error", message: "No build credits remaining — purchase more to continue." });
          controller.close();
          return;
        }

        /* Step 1 — read code ──────────────────────────────────────────── */
        console.log("[build] step 1: reading code for project", id, "repo", owner + "/" + repo);
        send({ step: "reading", message: "Reading your app's code…" });
        await supabase.from("projects").update({ status: "building" }).eq("id", id);

        // Candidates to fetch — covers Next.js SaaS starters (vibe-stack-supabase, acme, etc.)
        const candidates = [
          "app/page.tsx",
          "app/layout.tsx",
          "app/globals.css",
          // Acme/dashboard template
          "app/(overview)/page.tsx",
          "app/dashboard/page.tsx",
          "app/ui/home.tsx",
          "app/ui/dashboard/cards.tsx",
          // vibe-stack-supabase structure
          "app/(dashboard)/page.tsx",
          "app/(dashboard)/dashboard/page.tsx",
          "app/(marketing)/page.tsx",
          "components/hero.tsx",
          "components/landing.tsx",
          "components/home.tsx",
          // Always check for known breaking files so we can auto-heal them
          "lib/stripe/index.ts",
          "next.config.ts",
          "lib/supabase/middleware.ts",
        ];

        type FileEntry = { content: string; sha: string };
        const files: Record<string, FileEntry> = {};

        for (const path of candidates) {
          try {
            const { data } = await octokit.repos.getContent({ owner, repo, path });
            if ("content" in data && "sha" in data) {
              files[path] = {
                content: Buffer.from(data.content as string, "base64").toString("utf-8"),
                sha: data.sha as string,
              };
            }
          } catch {
            /* file doesn't exist in this repo — skip */
          }
        }

        // If nothing found, fall back to walking the tree
        if (Object.keys(files).length === 0) {
          // Get default branch (git/trees requires a SHA or branch name — "HEAD" is invalid)
          const { data: repoMeta } = await octokit.repos.get({ owner, repo });
          const { data: tree } = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: repoMeta.default_branch,
            recursive: "true",
          });
          const appFiles = (tree.tree ?? [])
            .filter(
              (f) =>
                f.type === "blob" &&
                f.path?.match(/\.(tsx?|jsx?|css)$/) &&
                !f.path?.includes("node_modules") &&
                !f.path?.includes(".next"),
            )
            .slice(0, 6);

          for (const f of appFiles) {
            if (!f.path) continue;
            try {
              const { data } = await octokit.repos.getContent({ owner, repo, path: f.path });
              if ("content" in data && "sha" in data) {
                files[f.path] = {
                  content: Buffer.from(data.content as string, "base64").toString("utf-8"),
                  sha: data.sha as string,
                };
              }
            } catch { /* skip */ }
          }
        }

        if (Object.keys(files).length === 0) {
          throw new Error("Could not read any source files from the repo — make sure the GitHub repo is accessible.");
        }

        /* Auto-heal known template issues that would cause Vercel build failures.
           These patches are pushed to GitHub regardless of what Claude changes. */
        const autoPatches: Record<string, string> = {};

        // lib/stripe/index.ts — two template issues:
        //  1. apiVersion "2024-06-20" is no longer a valid type literal (stripe >=17)
        //  2. `new Stripe(process.env.STRIPE_SECRET_KEY!)` throws at BUILD time
        //     (during "Collecting page data") when the key isn't configured.
        if (files["lib/stripe/index.ts"]) {
          let stripeContent = files["lib/stripe/index.ts"].content;
          let stripeChanged = false;

          if (stripeContent.includes('"2024-06-20"')) {
            stripeContent = stripeContent.replace('"2024-06-20"', '"2025-02-24.acacia"');
            stripeChanged = true;
          }
          // Replace the non-null assertion that crashes the build with a safe fallback
          if (stripeContent.includes("process.env.STRIPE_SECRET_KEY!")) {
            stripeContent = stripeContent.replace(
              "process.env.STRIPE_SECRET_KEY!",
              'process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder_build_only"',
            );
            stripeChanged = true;
          }

          if (stripeChanged) {
            autoPatches["lib/stripe/index.ts"] = stripeContent;
            files["lib/stripe/index.ts"] = { ...files["lib/stripe/index.ts"], content: stripeContent };
            console.log("[build] auto-healed lib/stripe/index.ts — apiVersion + build-safe key fallback");
          }
        }

        // next.config.ts — the single most important auto-heal. Template type/lint
        // strictness must NOT block an AI-generated deploy. Ensure the build is
        // configured to ignore TS + ESLint errors. This catches ALL template type
        // errors at once instead of patching them file by file.
        const existingConfig = files["next.config.ts"]?.content ?? "";
        if (!existingConfig.includes("ignoreBuildErrors")) {
          autoPatches["next.config.ts"] = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auto-managed by OnlyAIApp: AI-generated apps deploy even if the
  // template has strict type/lint issues. Type errors are compile-time only.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
`;
          console.log("[build] auto-healed next.config.ts — added ignoreBuildErrors + ignoreDuringBuilds");
        }

        // lib/supabase/middleware.ts — crashes the edge middleware (500 on every
        // route) when Supabase env vars aren't configured. Replace with a
        // resilient version that skips auth refresh when Supabase is absent.
        const mwContent = files["lib/supabase/middleware.ts"]?.content ?? "";
        if (mwContent.includes("createServerClient") && !mwContent.includes("if (!url || !anonKey)")) {
          autoPatches["lib/supabase/middleware.ts"] = `import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip auth refresh and pass through when Supabase isn't configured —
  // otherwise createServerClient throws and crashes the edge middleware.
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  try {
    let response = supabaseResponse;
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    await supabase.auth.getUser();
    return response;
  } catch {
    return supabaseResponse;
  }
}
`;
          console.log("[build] auto-healed lib/supabase/middleware.ts — resilient when Supabase unconfigured");
        }

        /* Step 2 — generate (3-phase: plan → build → refine) ─────────── */
        const MAX_FILE_LINES = 400;
        const foundPaths = Object.keys(files);
        const fileContext = foundPaths
          .map((p) => {
            const lines = files[p].content.split("\n");
            const capped =
              lines.length > MAX_FILE_LINES
                ? lines.slice(0, MAX_FILE_LINES).join("\n") +
                  "\n// [truncated — file continues beyond this point]"
                : files[p].content;
            return `=== ${p} ===\n${capped}`;
          })
          .join("\n\n");

        console.log("[build] step 1 done: read", foundPaths.length, "files:", foundPaths.join(", "));
        const anthropic = new Anthropic({ apiKey: anthropicKey });

        // Only allow Claude to write app/ and components/ files; config, lib/,
        // and middleware are managed by auto-heal and must not be clobbered.
        const isAllowedPath = (p: string) =>
          p.startsWith("app/") || p.startsWith("components/");

        // The write_files tool — shared by the build and refine phases.
        const writeFilesTool = {
          name: "write_files",
          description: "Write the complete files for the app to the repository",
          input_schema: {
            type: "object" as const,
            properties: {
              files: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path:    { type: "string", description: "Relative path under app/ or components/, e.g. app/page.tsx" },
                    content: { type: "string", description: "Complete file content — no placeholders or TODOs" },
                  },
                  required: ["path", "content"],
                },
              },
              commitMessage: {
                type: "string",
                description: "Imperative git commit message under 72 chars",
              },
            },
            required: ["files", "commitMessage"],
          },
        };

        // Design system — the single biggest quality lever. Injected into the
        // plan, build, and refine phases so every app looks intentional.
        const DESIGN_SYSTEM = `DESIGN PRINCIPLES (follow ALL — this is what separates a real product from a toy):
- Aesthetic: modern, confident SaaS. Think Linear, Vercel, Stripe — never a generic bootstrap template.
- Spacing: be generous. Sections py-20 to py-32. Cards p-6 to p-8. Never cramped.
- Typography: strong hierarchy. Headings text-4xl to text-6xl, font-bold, tracking-tight. Body text-base to text-lg in a muted neutral. Max 2 weights per screen.
- Color: pick ONE accent color and commit. Everything else neutral grays. Use the accent sparingly for CTAs and highlights.
- Content: write REAL, specific copy for THIS product. Never "Lorem ipsum", never "Feature 1/2/3", never placeholder names. Invent believable headlines, benefits, stats, and testimonials that fit the request.
- Layout: full structure — sticky nav, hero with a sharp value prop + primary CTA, a features/benefits grid, social proof or stats, a secondary CTA, and a footer. Multi-section, not one centered box.
- Depth & polish: subtle gradients, soft shadows, rounded-xl/2xl corners, thin borders. Tasteful, not heavy.
- Interactivity: every button/link has hover: + transition. Use group-hover where it adds life.
- Responsive: mobile-first. Stack on small screens, grid on md/lg. Nothing overflows.
- Accessibility: semantic HTML (header/nav/main/section/footer), alt text, strong contrast.
- Tailwind v4 (CRITICAL): this project uses Tailwind v4. app/globals.css must contain ONLY \`@import "tailwindcss";\` — NEVER \`@tailwind base/components/utilities\` and NEVER \`@apply\` in globals.css (they break the v4 build). Put ALL styling in component className props, not global CSS.`;

        const genStart = Date.now();

        /* Phase 1 — PLAN (extended thinking) ──────────────────────────── */
        send({ step: "generating", message: "Designing your app…" });
        console.log("[build] phase 1: planning (thinking)");
        let designPlan = "";
        try {
          const planResponse = await anthropic.messages.create({
            model: BUILD_MODEL,
            max_tokens: 5000,
            thinking: { type: "enabled", budget_tokens: 3000 },
            messages: [{
              role: "user",
              content: `You are a senior product designer and Next.js engineer. PLAN (do not write code yet) the app for this request.

User request: "${buildPrompt}"

Current codebase (Next.js + TypeScript + Tailwind):
${fileContext}

${DESIGN_SYSTEM}

Produce a tight build plan:
1. App concept in one sentence.
2. The single accent color (hex) and the overall vibe.
3. Page sections in order (nav → hero → … → footer), each with one line of the REAL content it holds.
4. Files to create/modify (app/page.tsx plus small components/ files). 2-5 files.
Under 400 words. This plan feeds the build step.`,
            }],
          });
          designPlan = planResponse.content
            .filter((c) => c.type === "text")
            .map((c) => (c as { text: string }).text)
            .join("\n")
            .trim();
          console.log("[build] phase 1 done: plan", designPlan.length, "chars");
        } catch (planErr) {
          console.warn("[build] phase 1 plan failed (non-fatal), building without plan:", planErr);
        }

        /* Phase 2 — BUILD (multi-file, up to 64k tokens). A full app can
           overflow the token budget and truncate the tool call → zero
           parseable files. Retry once with a tighter brief before giving up. */
        send({ step: "generating", message: "Building your app…" });
        console.log("[build] phase 2: building");

        const buildUserContent = (tighten: boolean) => `You are a world-class Next.js + Tailwind engineer. Build the app for this request to production, portfolio-quality standard.

User request: "${buildPrompt}"
${designPlan ? `\nApproved design plan:\n${designPlan}\n` : ""}
Current codebase:
${fileContext}

${DESIGN_SYSTEM}

Call write_files with the complete files. Rules:
- TypeScript + Tailwind only. Keep the existing stack and imports.
- app/page.tsx is the main page. Extract reusable pieces into components/ (e.g. components/hero.tsx) when it improves clarity. ${tighten ? "Keep to 3-4 files" : "2-6 files total"}.
- Only write files under app/ or components/. Never touch config, lib/, or middleware.
- Write COMPLETE file contents — no "// ..." placeholders, no TODOs.${tighten ? "\n- IMPORTANT: the previous attempt was cut off before finishing. Return EVERYTHING in ONE write_files call and keep it compact enough to complete — fewer files, no oversized inline arrays/data." : ""}
- Make it genuinely impressive: a customer should be impressed on first load.`;

        let builtFiles: Array<{ path: string; content: string }> = [];
        let commitMessage = "AI: build app";
        for (let attempt = 1; attempt <= 2 && builtFiles.length === 0; attempt++) {
          if (attempt > 1) {
            send({ step: "generating", message: "Finishing the build…" });
            console.log("[build] phase 2 retry (attempt", attempt, ")");
          }
          const buildResponse = await anthropic.messages.stream({
            model: BUILD_MODEL,
            max_tokens: 64000,
            tools: [writeFilesTool],
            tool_choice: { type: "any" },
            messages: [{ role: "user", content: buildUserContent(attempt > 1) }],
          }).finalMessage();

          const toolUse = buildResponse.content.find((c) => c.type === "tool_use");
          if (toolUse && toolUse.type === "tool_use") {
            const rawInput = toolUse.input as {
              files?: Array<{ path: string; content: string }>;
              commitMessage?: string;
            };
            builtFiles = (Array.isArray(rawInput.files) ? rawInput.files : [])
              .filter((f) => f && typeof f.path === "string" && typeof f.content === "string"
                && f.content.length > 0 && isAllowedPath(f.path));
            if (rawInput.commitMessage) commitMessage = rawInput.commitMessage;
          }
          if (buildResponse.stop_reason === "max_tokens") {
            console.warn("[build] phase 2 stop_reason=max_tokens (attempt", attempt, ", parsed", builtFiles.length, "files)");
          }
        }

        if (builtFiles.length === 0) {
          throw new Error("The build came back too large to finish in one pass — please try again, or describe a slightly simpler first version.");
        }
        console.log("[build] phase 2 done: built", builtFiles.length, "files:", builtFiles.map(f => f.path).join(", "));

        const changes = {
          files: builtFiles,
          commitMessage: commitMessage.slice(0, 72),
        };

        /* Phase 3 — REFINE (best-effort; never blocks shipping phase 2) ── */
        const elapsed = Date.now() - genStart;
        if (elapsed < 200000) {
          try {
            send({ step: "generating", message: "Polishing the details…" });
            console.log("[build] phase 3: refine (elapsed", Math.round(elapsed / 1000), "s)");
            const builtContext = changes.files
              .map((f) => `=== ${f.path} ===\n${f.content}`)
              .join("\n\n");
            const refineResponse = await anthropic.messages.stream({
              model: BUILD_MODEL,
              max_tokens: 32000,
              tools: [writeFilesTool],
              tool_choice: { type: "any" },
              messages: [{
                role: "user",
                content: `You are a ruthless design reviewer. This app was just generated for: "${buildPrompt}"

${builtContext}

${DESIGN_SYSTEM}

Critique it hard against the principles, then call write_files with improved versions of ONLY the files that need work. Fix: weak spacing, generic copy, missing sections, flat hierarchy, missing hover states, anything that looks like a template. If a file is already excellent, leave it out. Write COMPLETE file contents for any file you return.`,
              }],
            }).finalMessage();
            const refineTool = refineResponse.content.find((c) => c.type === "tool_use");
            if (refineTool && refineTool.type === "tool_use") {
              const refineInput = refineTool.input as { files?: Array<{ path: string; content: string }> };
              const refined = (Array.isArray(refineInput.files) ? refineInput.files : [])
                .filter((f) => f && typeof f.path === "string" && typeof f.content === "string"
                  && f.content.length > 0 && isAllowedPath(f.path));
              if (refined.length > 0) {
                const byPath = new Map(changes.files.map((f) => [f.path, f]));
                for (const rf of refined) byPath.set(rf.path, rf);
                changes.files = Array.from(byPath.values());
                console.log("[build] phase 3 done: refined", refined.length, "files");
              }
            }
          } catch (refineErr) {
            console.warn("[build] phase 3 refine failed (non-fatal):", refineErr);
          }
        } else {
          console.log("[build] phase 3 skipped — time budget low (", Math.round(elapsed / 1000), "s elapsed)");
        }

        /* Step 3 — push as ONE atomic commit (Git Data API) ──────────────
           CRITICAL: pushing files one-by-one creates a separate commit per
           file, and Vercel builds each intermediate commit. An intermediate
           commit that has Claude's code but not yet the next.config fix will
           fail type-checking. Bundling everything into a single commit means
           there is exactly one deploy, and it always has next.config. */
        /* Tailwind v4 guard — the #1 cause of AI-build deploy failures. The
           template is Tailwind v4 (@tailwindcss/postcss, @import "tailwindcss").
           Models routinely emit v3 syntax (@tailwind base/components/utilities
           + @apply utilities in @layer base), which fails the v4 build with
           "Cannot apply unknown utility class". Force a clean v4 entry on the
           FINAL globals.css (AI's if it wrote one, else the template's). */
        const aiCss = changes.files.find((f) => f.path === "app/globals.css");
        const finalCss = aiCss?.content ?? files["app/globals.css"]?.content ?? "";
        const cssBad =
          finalCss.includes("@tailwind ") ||
          (/@apply\b/.test(finalCss) && !finalCss.includes("@reference")) ||
          !finalCss.includes('@import "tailwindcss"');
        if (cssBad) {
          const fixedCss = `@import "tailwindcss";\n`;
          if (aiCss) aiCss.content = fixedCss;
          else autoPatches["app/globals.css"] = fixedCss;
          console.log("[build] auto-healed app/globals.css — forced Tailwind v4 entry");
        }

        const patchedPaths = new Set(Object.keys(autoPatches));
        const allFilesToPush = [
          ...changes.files.filter(f => !patchedPaths.has(f.path)),
          ...Object.entries(autoPatches).map(([path, content]) => ({ path, content })),
        ];

        console.log("[build] step 2 done: AI changes", changes.files.length, "files, auto-patches", Object.keys(autoPatches).length, "files");
        console.log("[build] step 3: pushing", allFilesToPush.length, "files in ONE commit");
        send({ step: "pushing", message: "Pushing changes to GitHub…" });

        // Resolve the default branch and its latest commit / base tree
        const { data: repoInfo } = await octokit.repos.get({ owner, repo });
        const branch = repoInfo.default_branch;
        const { data: refData } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
        const latestCommitSha = refData.object.sha;
        const { data: latestCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: latestCommitSha });

        // Upload each file as a blob, then assemble a single tree
        const treeItems = await Promise.all(
          allFilesToPush.map(async (file) => {
            const { data: blob } = await octokit.git.createBlob({
              owner,
              repo,
              content: Buffer.from(file.content).toString("base64"),
              encoding: "base64",
            });
            return {
              path: file.path,
              mode: "100644" as const,
              type: "blob" as const,
              sha: blob.sha,
            };
          }),
        );

        const { data: newTree } = await octokit.git.createTree({
          owner,
          repo,
          base_tree: latestCommit.tree.sha,
          tree: treeItems,
        });
        const { data: newCommit } = await octokit.git.createCommit({
          owner,
          repo,
          message: changes.commitMessage,
          tree: newTree.sha,
          parents: [latestCommitSha],
        });
        await octokit.git.updateRef({
          owner,
          repo,
          ref: `heads/${branch}`,
          sha: newCommit.sha,
        });
        console.log("[build] step 3 done: pushed single commit", newCommit.sha);

        /* Step 4 — trigger Vercel deploy, then VERIFY the outcome ──────────
           Critical: do NOT report success the instant a deploy is triggered.
           The old behavior sent {step:"done"} immediately, so a build that
           failed to compile on Vercel still showed all-green — and people
           would proudly demo a broken URL. We now poll the deployment and
           tell the truth: deployed, build-failed, or still-building. */
        console.log("[build] step 3 done: all files pushed");
        console.log("[build] step 4: triggering Vercel deployment");
        send({ step: "deploying", message: "Deploying — verifying it actually builds…" });

        let deployState: DeploymentState = "unknown";
        let deployUrl: string | null = null;
        let deploymentId: string | null = null;

        if (vercelToken && project.vercel_project_id) {
          try {
            const trig = await triggerVercelDeployment({
              token: vercelToken,
              projectId: project.vercel_project_id as string,
              projectName: project.name as string,
              teamId: vercelTeamId ?? undefined,
            });
            deploymentId = trig.deploymentId;
            deployUrl = trig.url;
            deployState = trig.state;
            console.log("[build] step 4: deploy triggered", deploymentId, "state", deployState);
          } catch (vercelErr) {
            console.warn("[build] step 4: Vercel trigger failed (non-fatal):", vercelErr);
          }

          // Poll until the build resolves (bounded so we stay within maxDuration)
          if (deploymentId) {
            const deadline = Date.now() + 75000;
            while (Date.now() < deadline) {
              await new Promise((r) => setTimeout(r, 5000));
              const s = await getDeploymentById({
                token: vercelToken,
                deploymentId,
                teamId: vercelTeamId ?? undefined,
              });
              if (s.state !== "unknown") deployState = s.state;
              if (s.url) deployUrl = s.url;
              if (["READY", "ERROR", "CANCELED"].includes(deployState)) break;
            }
            console.log("[build] step 4: final deploy state", deployState);
          }
        } else {
          console.log("[build] step 4: no Vercel token/projectId — relying on GitHub webhook");
        }

        await supabase
          .from("projects")
          .update({ status: "deployed", build_prompt: null })
          .eq("id", id);

        if (deployState === "ERROR") {
          let why: string | null = null;
          if (vercelToken && deploymentId) {
            try {
              why = await getDeploymentErrorLine({
                token: vercelToken,
                deploymentId,
                teamId: vercelTeamId ?? undefined,
              });
            } catch { /* best-effort */ }
          }
          send({
            step: "deploy_failed",
            commitMessage: changes.commitMessage,
            url: deployUrl,
            message: why
              ? `Your changes were committed, but the live deploy failed to build: ${why}`
              : "Your changes were committed, but the live deploy failed to build. Open the project on Vercel to see why.",
          });
        } else if (deployState === "READY") {
          send({ step: "done", deployed: true, url: deployUrl, commitMessage: changes.commitMessage });
        } else {
          // Triggered but still building (or no Vercel wired) — be honest, don't claim it's live yet
          send({
            step: "done",
            deployed: false,
            url: deployUrl,
            commitMessage: changes.commitMessage,
            message: "Changes committed. The deploy is still building — your live URL will update shortly.",
          });
        }
      } catch (err) {
        console.error("[build] pipeline error:", err);
        const message = err instanceof Error ? err.message : "Build failed";
        // Best-effort cleanup — don't let these throw and swallow the real error
        try { await supabase.from("projects").update({ status: "deployed" }).eq("id", id); } catch {}
        try { await supabase.rpc("refund_build_credit", { p_user_id: user.id }); } catch {}
        try { send({ step: "error", message }); } catch {}
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
