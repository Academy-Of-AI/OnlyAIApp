import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * POST /api/projects/:id/build
 * Reads the user's GitHub repo, sends files to Claude, commits AI-generated
 * changes back, and lets Vercel auto-deploy via the GitHub webhook.
 * Streams SSE progress events to the client.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  /* ── auth ────────────────────────────────────────────────────────────── */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  if (!profile || profile.build_credits <= 0) {
    return NextResponse.json(
      { error: "No build credits remaining — purchase more to continue.", code: "no_credits" },
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
  if (!project.build_prompt)
    return NextResponse.json({ error: "No build prompt saved" }, { status: 400 });
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

  /* ── load github token ───────────────────────────────────────────────── */
  const { data: githubConn } = await supabase
    .from("oauth_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("provider", "github")
    .single();

  if (!githubConn)
    return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  const githubToken = await decrypt(githubConn.access_token as string);
  const octokit = new Octokit({ auth: githubToken });

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

        // Candidates to fetch (Acme / Next.js dashboard template structure)
        const candidates = [
          "app/page.tsx",
          "app/layout.tsx",
          "app/(overview)/page.tsx",
          "app/dashboard/page.tsx",
          "app/ui/home.tsx",
          "app/ui/dashboard/cards.tsx",
          "app/globals.css",
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
          const { data: tree } = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: "HEAD",
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

        /* Step 2 — generate ──────────────────────────────────────────── */
        console.log("[build] step 1 done: read", Object.keys(files).length, "files:", Object.keys(files).join(", "));
        console.log("[build] step 2: calling Anthropic with prompt:", project.build_prompt?.slice(0, 120));
        send({ step: "generating", message: "Generating your changes…" });

        const anthropic = new Anthropic({ apiKey: anthropicKey });

        const userMessage = `You are a senior Next.js developer. The user wants to modify their app.

User request: "${project.build_prompt}"

Current codebase:
${Object.entries(files)
  .map(([p, { content }]) => `=== ${p} ===\n${content}`)
  .join("\n\n")}

Call the write_files tool with the minimal changes needed to fulfil the request.
Rules:
- Only include files that actually need to change (1–4 files max)
- Keep TypeScript + Tailwind CSS — same stack, same imports
- Write the full file content for each changed file`;

        // Use tool use to guarantee structured output — no JSON parsing needed
        const aiResponse = await anthropic.messages.create({
          model: "claude-opus-4-5",
          max_tokens: 8000,
          tools: [
            {
              name: "write_files",
              description: "Write the changed files to the repository",
              input_schema: {
                type: "object" as const,
                properties: {
                  files: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        path:    { type: "string", description: "Relative file path, e.g. app/page.tsx" },
                        content: { type: "string", description: "Full file content" },
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
            },
          ],
          tool_choice: { type: "any" },
          messages: [{ role: "user", content: userMessage }],
        });

        const toolUse = aiResponse.content.find((c) => c.type === "tool_use");
        if (!toolUse || toolUse.type !== "tool_use") {
          throw new Error("AI did not generate file changes — please try again.");
        }

        const changes = toolUse.input as {
          files: Array<{ path: string; content: string }>;
          commitMessage: string;
        };

        /* Step 3 — push ──────────────────────────────────────────────── */
        console.log("[build] step 2 done: AI wants to change", changes.files.length, "files:", changes.files.map(f => f.path).join(", "));
        console.log("[build] step 3: pushing to GitHub");
        send({ step: "pushing", message: "Pushing changes to GitHub…" });

        for (const file of changes.files) {
          const existing = files[file.path];
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: file.path,
            message: changes.commitMessage,
            content: Buffer.from(file.content).toString("base64"),
            ...(existing ? { sha: existing.sha } : {}),
          });
        }

        /* Step 4 — deploying ─────────────────────────────────────────── */
        console.log("[build] step 3 done: all files pushed");
        console.log("[build] step 4: waiting for Vercel deploy");
        send({ step: "deploying", message: "Vercel is deploying your app…" });

        // Revert to "deployed" — Vercel webhook will handle the actual deploy
        await supabase
          .from("projects")
          .update({ status: "deployed", build_prompt: null })
          .eq("id", id);

        // Brief pause so the client can show the step
        await new Promise((r) => setTimeout(r, 1500));

        send({ step: "done", commitMessage: changes.commitMessage });
      } catch (err) {
        console.error("[build] pipeline error:", err);
        const message = err instanceof Error ? err.message : "Build failed";
        // Restore project status
        await supabase.from("projects").update({ status: "deployed" }).eq("id", id);
        // Refund the credit so the user isn't charged for a failed build
        await supabase.rpc("refund_build_credit", { p_user_id: user.id });
        send({ step: "error", message });
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
