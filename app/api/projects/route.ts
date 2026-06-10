import { decrypt } from "@/lib/crypto";
import { registerPushWebhook, getCommitIdentity, getGithubUser } from "@/lib/github";
import { provisionProject, type ProgressEvent } from "@/lib/provisioning";
import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";
import { projectLimit, normalizePlan, isProUser } from "@/lib/plan";
import { NextResponse } from "next/server";

export const maxDuration = 300;

/**
 * GET /api/projects — list current user's projects
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/projects — provision a new project (streams SSE progress)
 * Body: { name, templateId?, supabaseUrl?, supabaseAnonKey? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    name: string;
    templateId?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  };

  const { name, templateId = "vibe-stack-supabase", supabaseUrl, supabaseAnonKey } = body;

  if (!name?.match(/^[a-z0-9-]{3,40}$/)) {
    return NextResponse.json(
      { error: "Name must be 3–40 lowercase letters, numbers, or hyphens" },
      { status: 400 },
    );
  }

  // Per-tier project limit (free = 1, +1 for the first 50 builders, +1 with the
  // product-updates opt-in, +1 per referral; core/pro = 8). Capped at 8.
  const { data: planRow } = await supabase
    .from("profiles").select("plan, phone, marketing_consent, github_id, bonus_projects").eq("id", user.id).single();
  // Slots in use — mirror project_slots_used() in migration 009 EXACTLY: count
  // everything except 'failed' and never-finished (stale > 15 min) 'provisioning',
  // so a failed/abandoned attempt never permanently burns a slot, while a fresh
  // in-flight provisioning DOES count. (Filtered in JS — ≤8 rows — to match the
  // SQL precisely without PostgREST or-filter gymnastics.)
  const { data: ownRows } = await supabase
    .from("projects").select("status, created_at").eq("user_id", user.id);
  const staleCutoff = Date.now() - 15 * 60 * 1000;
  const ownedCount = (ownRows ?? []).filter((p) => {
    if (p.status === "failed") return false;
    if (p.status === "provisioning" && new Date(p.created_at as string).getTime() < staleCutoff) return false;
    return true;
  }).length;
  const limit = projectLimit(planRow?.plan, planRow?.bonus_projects ?? 0, planRow);
  // Single source for the friendly over-limit response (used by the pre-check
  // AND the DB-backstop rejection below, so they never drift).
  const planLimitResponse = () => {
    const tier = normalizePlan(planRow?.plan);
    return NextResponse.json(
      tier === "free"
        ? { error: `You've reached your Free limit (${limit} project${limit === 1 ? "" : "s"}). Refer a friend to earn a bonus slot, or upgrade to Core for up to 8.`, code: "plan_limit" }
        : { error: `Your plan includes ${limit} projects. Delete one you don't need to free a slot.`, code: "plan_limit" },
      { status: 403 },
    );
  };
  if (ownedCount >= limit) return planLimitResponse();

  // Load GitHub + Vercel + Supabase (optional) connections
  const { data: connections } = await supabase
    .from("oauth_connections")
    .select("provider, access_token, metadata")
    .eq("user_id", user.id)
    .in("provider", ["github", "vercel", "supabase", "resend"]);

  const githubConn = connections?.find((c) => c.provider === "github");
  const vercelConn = connections?.find((c) => c.provider === "vercel");
  const supabaseConn = connections?.find((c) => c.provider === "supabase");

  // GitHub is the only requirement for the onramp. Vercel/Supabase are optional —
  // a newbie gets a repo + Claude Code now, and connects deploy/db later.
  if (!githubConn) {
    return NextResponse.json({ error: "Connect GitHub to create a project." }, { status: 400 });
  }

  const githubToken = await decrypt(githubConn.access_token as string);
  const vercelToken = vercelConn ? await decrypt(vercelConn.access_token as string) : undefined;

  // Anti-burner: bind this GitHub identity to this workspace (one GitHub → one workspace).
  try {
    const gh = await getGithubUser(githubToken);
    if (gh?.id) {
      if (!planRow?.github_id) {
        const { error: bindErr } = await supabase.from("profiles").update({ github_id: gh.id }).eq("id", user.id);
        if (bindErr) {
          return NextResponse.json(
            { error: "This GitHub account is already linked to another OnlyAIApp workspace.", code: "github_taken" },
            { status: 403 },
          );
        }
      } else if (planRow.github_id !== gh.id) {
        return NextResponse.json(
          { error: "This workspace is bound to a different GitHub account.", code: "github_mismatch" },
          { status: 403 },
        );
      }
    }
  } catch { /* non-fatal — don't block provisioning on the identity lookup */ }

  const resendConn   = connections?.find((c) => c.provider === "resend");

  let supabaseToken: string | undefined;
  let supabaseOrgId: string | undefined;
  let resendApiKey:  string | undefined;

  if (supabaseConn) {
    supabaseToken = await decrypt(supabaseConn.access_token as string);
    const meta = supabaseConn.metadata as { org_id?: string } | null;
    supabaseOrgId = meta?.org_id;
  }

  if (resendConn) {
    resendApiKey = await decrypt(resendConn.access_token as string);
  }

  // Insert project record as provisioning
  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      template_id: templateId,
      status: "provisioning",
    })
    .select()
    .single();

  if (insertError || !project) {
    // The DB backstop (trigger trg_enforce_project_limit, migration 009) rejects
    // an insert that would exceed the limit — the concurrent-create race the
    // pre-check above can't catch. Map it to the same friendly 403, not a 500.
    if (insertError?.message?.includes("project_limit_exceeded")) return planLimitResponse();
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  // Stream SSE progress back to the client
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const tpl = getTemplate(templateId);
        const result = await provisionProject(
          {
            projectName: name,
            githubToken,
            vercelToken,
            supabaseToken,
            supabaseOrgId,
            supabaseUrl,
            supabaseAnonKey,
            resendApiKey,
            templateOwner: tpl.owner,
            templateRepo: tpl.repo,
          },
          (progressEvent: ProgressEvent) => send(progressEvent),
        );

        // Update project to deployed
        await supabase
          .from("projects")
          .update({
            status: result.vercelProjectId ? "deployed" : "ready",
            github_repo_url: result.githubRepoUrl,
            vercel_project_id: result.vercelProjectId ?? null,
            vercel_preview_url: result.vercelPreviewUrl ?? null,
            supabase_project_ref: result.supabaseProjectRef ?? null,
            deployed_at: new Date().toISOString(),
          })
          .eq("id", project.id);

        // Pilot (anchor & monitor): default-on auto-capture for new projects. Register
        // the push webhook + flip the flag so Plan / On-track / What-it-knows
        // start working automatically. Pilot is a Pro feature, so only wire this
        // up for Pro users. Best-effort — never fail provisioning.
        try {
          if (await isProUser(supabase, user.id)) {
            const repoMatch = result.githubRepoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get("origin") ?? "";
            if (repoMatch && appUrl) {
              await registerPushWebhook({
                token: githubToken,
                owner: repoMatch[1],
                repo: repoMatch[2].replace(/\.git$/, ""),
                callbackUrl: `${appUrl}/api/github/webhook`,
                secret: process.env.GITHUB_WEBHOOK_SECRET,
              });
              await supabase.from("projects").update({ auto_capture: true }).eq("id", project.id);
            }
          }
        } catch (e) {
          console.warn("[provision] default-on auto-capture failed (non-fatal):", e);
        }

        // The git identity the handed-off project must commit with so Vercel
        // doesn't block deploys ("commit email could not be matched to a GitHub
        // account"). Best-effort — never fail provisioning over it.
        let commitEmail: string | undefined;
        let commitName: string | undefined;
        try {
          const ident = await getCommitIdentity(githubToken);
          commitEmail = ident.email;
          commitName = ident.name;
        } catch (e) {
          console.warn("[provision] commit identity lookup failed (non-fatal):", e);
        }

        // Track event
        await supabase.from("events").insert({
          user_id: user.id,
          event: "project_provisioned",
          properties: { projectId: project.id, templateId, name },
        });

        send({
          step: "done",
          result: {
            id: project.id,
            githubRepoUrl: result.githubRepoUrl,
            vercelPreviewUrl: result.vercelPreviewUrl,
            supabaseProjectRef: result.supabaseProjectRef,
            commitEmail,
            commitName,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";

        await supabase
          .from("projects")
          .update({ status: "failed", error: message })
          .eq("id", project.id);

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
