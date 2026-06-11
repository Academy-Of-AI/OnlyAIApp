import { decrypt } from "@/lib/crypto";
import { registerPushWebhook, getCommitIdentity, getGithubUser } from "@/lib/github";
import { provisionProject, type ProgressEvent } from "@/lib/provisioning";
import { friendlyProvisionError } from "@/lib/provisioning/errors";
import { coarseStep, STALE_PROVISION_MS, type ProvisionStep } from "@/lib/provisioning/steps";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConn } from "@/lib/supabase-conn";
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
    .is("archived_at", null)            // hide soft-archived (superseded) rows
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
    projectId?: string;   // retry/resume: reuse an existing row instead of inserting
  };

  const { name, templateId = "vibe-stack-supabase", supabaseUrl, supabaseAnonKey, projectId } = body;

  if (!name?.match(/^[a-z0-9-]{3,40}$/)) {
    return NextResponse.json(
      { error: "Name must be 3–40 lowercase letters, numbers, or hyphens" },
      { status: 400 },
    );
  }

  // CREATE-OR-RESUME: resolve the row we'll provision into BEFORE the limit gate,
  // so a retry/resume of an existing row is never blocked by the project limit
  // (the limit only applies to genuinely-new rows).
  // - { projectId } provided → load + own-check that row (404 if not owned).
  // - else find the most-recent existing row for this user with the same name,
  //   status in ('provisioning','failed'), archived_at IS NULL → reuse it.
  // - else (resolveExisting null) → INSERT a fresh row below.
  let resolvedExisting:
    | {
        id: string;
        github_repo_url: string | null;
        supabase_project_ref: string | null;
        vercel_project_id: string | null;
        provision_attempt_count: number;
      }
    | null = null;

  if (projectId) {
    const { data: row } = await supabase
      .from("projects")
      .select("id, user_id, github_repo_url, supabase_project_ref, vercel_project_id, provision_attempt_count")
      .eq("id", projectId)
      .single();
    if (!row || row.user_id !== user.id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    resolvedExisting = {
      id: row.id as string,
      github_repo_url: (row.github_repo_url as string | null) ?? null,
      supabase_project_ref: (row.supabase_project_ref as string | null) ?? null,
      vercel_project_id: (row.vercel_project_id as string | null) ?? null,
      provision_attempt_count: (row.provision_attempt_count as number | null) ?? 0,
    };
  } else {
    const { data: row } = await supabase
      .from("projects")
      .select("id, github_repo_url, supabase_project_ref, vercel_project_id, provision_attempt_count")
      .eq("user_id", user.id)
      .eq("name", name)
      .in("status", ["provisioning", "failed"])
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (row) {
      resolvedExisting = {
        id: row.id as string,
        github_repo_url: (row.github_repo_url as string | null) ?? null,
        supabase_project_ref: (row.supabase_project_ref as string | null) ?? null,
        vercel_project_id: (row.vercel_project_id as string | null) ?? null,
        provision_attempt_count: (row.provision_attempt_count as number | null) ?? 0,
      };
    }
  }
  const isReuse = resolvedExisting !== null;

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
  const staleCutoff = Date.now() - STALE_PROVISION_MS;
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
  // Reuse/retry of an existing row must NOT be blocked by the limit — only
  // genuinely-new rows go through the pre-check.
  if (!isReuse && ownedCount >= limit) return planLimitResponse();

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
    // Refresh-aware: a one-click OAuth Supabase token is short-lived; the helper
    // refreshes it transparently (and passes a paste-token through unchanged).
    const sc = await getSupabaseConn(supabase, user.id);
    if (sc) { supabaseToken = sc.token; supabaseOrgId = sc.orgId; }
  }

  if (resendConn) {
    resendApiKey = await decrypt(resendConn.access_token as string);
  }

  // CREATE-OR-RESUME the project row.
  // - Reuse: flip the existing row back to provisioning, clear the prior error,
  //   and bump the attempt counter — no new card is created (kills the pile-up).
  // - New: INSERT a fresh provisioning row (still subject to the 009 DB backstop).
  let project: { id: string };
  if (isReuse && resolvedExisting) {
    // CAS LEASE — flip the row to 'provisioning' ONLY if it's currently 'failed'
    // or a STALE 'provisioning' (abandoned > STALE_PROVISION_MS ago). This is an
    // atomic compare-and-swap: under READ COMMITTED, two concurrent retries
    // (double-click, two tabs, an SSE reconnect, or a create-again while the
    // first attempt is still in flight) both target this row, but only one UPDATE
    // re-passes the predicate after taking the row lock — the loser updates 0
    // rows. That makes "one provision per project at a time" impossible to
    // violate, so a second run can't spawn orphan repos/DBs past the failure
    // point. The timestamp is quoted because it contains PostgREST-reserved chars.
    const staleBefore = new Date(Date.now() - STALE_PROVISION_MS).toISOString();
    const { data: leased } = await supabase
      .from("projects")
      .update({
        status: "provisioning",
        error: null,
        provision_attempt_count: resolvedExisting.provision_attempt_count + 1,
        provision_started_at: new Date().toISOString(),
      })
      .eq("id", resolvedExisting.id)
      .eq("user_id", user.id)
      .or(`status.eq.failed,and(status.eq.provisioning,provision_started_at.lt."${staleBefore}")`)
      .select("id")
      .maybeSingle();

    if (!leased) {
      // Lost the lease — another attempt holds it, or the project already
      // finished. Re-read to return an accurate, friendly 409 (not a generic 500).
      const { data: cur } = await supabase
        .from("projects").select("status").eq("id", resolvedExisting.id).eq("user_id", user.id).maybeSingle();
      const status = (cur?.status as string | undefined) ?? "provisioning";
      if (status === "deployed" || status === "ready") {
        return NextResponse.json({ error: "This project is already set up.", code: "already_done" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "Setup is already running for this project — give it a minute, then refresh.", code: "provision_in_progress" },
        { status: 409 },
      );
    }
    project = { id: leased.id as string };
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name,
        template_id: templateId,
        status: "provisioning",
        provision_started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // The DB backstop (trigger trg_enforce_project_limit, migration 009) rejects
      // an insert that would exceed the limit — the concurrent-create race the
      // pre-check above can't catch. Map it to the same friendly 403, not a 500.
      if (insertError?.message?.includes("project_limit_exceeded")) return planLimitResponse();
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }
    project = { id: inserted.id as string };
  }

  // Collapse the pile-up: soft-hide any OTHER same-name failed cards for this
  // user so the dashboard shows a single active row instead of a stack of dead
  // duplicates. archived_at hides them from both list views and the reuse query
  // — reversible (never a hard delete). Best-effort; never block provisioning.
  await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("name", name)
    .eq("status", "failed")
    .is("archived_at", null)
    .neq("id", project.id);

  // Stream SSE progress back to the client
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Track the coarse step in flight so a failure can record exactly where it
      // stopped. coarseStep() (lib/provisioning/steps) maps the fine-grained SSE
      // step names (github_start, supabase_done, env_done, deploy_start, …) down
      // to the coarse milestone, keeping the last known-good step as the fallback.
      let lastStep: ProvisionStep = "github";

      // Build the resume context from the row's saved external IDs. github_repo_url
      // → full_name ("owner/repo"); the others pass through. Undefined fields tell
      // provisionProject to (re)create that step from scratch.
      const repoFullName = resolvedExisting?.github_repo_url
        ? resolvedExisting.github_repo_url.match(/github\.com\/([^/]+\/[^/?#]+?)(?:\.git)?(?:[/?#]|$)/)?.[1]
        : undefined;
      const existing = {
        githubRepoFullName: repoFullName,
        supabaseProjectRef: resolvedExisting?.supabase_project_ref ?? undefined,
        vercelProjectId: resolvedExisting?.vercel_project_id ?? undefined,
      };

      // Per-step persistence: write each external ID the moment it's created so a
      // later failure leaves a resumable row (no orphans).
      const persist = async (patch: {
        provision_step?: string;
        github_repo_url?: string;
        supabase_project_ref?: string;
        supabase_url?: string;
        vercel_project_id?: string;
        vercel_preview_url?: string;
      }) => {
        await supabase.from("projects").update(patch).eq("id", project.id);
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
            existing,
            persist,
          },
          (progressEvent: ProgressEvent) => {
            lastStep = coarseStep(progressEvent.step, lastStep);
            send(progressEvent);
          },
        );

        // Settle the row HONESTLY. A Vercel deploy was only just *triggered* — it
        // isn't live yet (the bare *.vercel.app alias 404s until the first
        // production build reaches READY). So we mark it "building", NOT
        // "deployed", and leave deployed_at unset. The deploy-status route
        // (polled by the UI) flips it to "deployed" once Vercel reports READY,
        // or "failed" on a build error. No vercel project ⇒ "ready" (repo only).
        await supabase
          .from("projects")
          .update({
            status: result.vercelProjectId ? "building" : "ready",
            github_repo_url: result.githubRepoUrl,
            vercel_project_id: result.vercelProjectId ?? null,
            vercel_preview_url: result.vercelPreviewUrl ?? null,
            supabase_project_ref: result.supabaseProjectRef ?? null,
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
        const friendly = friendlyProvisionError(message);
        console.error("[provision] failed:", message); // raw stays in logs

        // Update the SAME row in place (never insert a new one) and record the
        // step it stopped at so the UI can show it + Retry can resume from here.
        await supabase
          .from("projects")
          .update({ status: "failed", error: friendly, provision_step: lastStep })
          .eq("id", project.id);

        send({ step: "error", message: friendly });
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
