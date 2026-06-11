import { createRepoFromTemplate, deleteRepo, getGithubUser, githubClient } from "@/lib/github";
import {
  configureAuthSmtp,
  createSupabaseProject,
  deleteSupabaseProject,
  getProjectKeys,
  waitForProject,
} from "@/lib/supabase-mgmt";
import { addVercelEnvVars, createVercelProject, deleteVercelProject, getVercelProjectDomain, triggerVercelDeployment } from "@/lib/vercel";

export type ProgressEvent = {
  step: string;      // e.g. "github_done"
  message: string;   // human-readable e.g. "GitHub repo created ✓"
  detail?: string;   // optional sub-detail
};

export interface ProvisionParams {
  projectName: string;
  githubToken: string;
  vercelToken?: string;      // optional — GitHub-only onramp skips Vercel
  supabaseToken?: string;    // optional — if not provided, skip Supabase auto-provision
  supabaseOrgId?: string;
  supabaseUrl?: string;      // manual override (legacy)
  supabaseAnonKey?: string;  // manual override (legacy)
  resendApiKey?: string;     // optional — injected as RESEND_API_KEY if provided
  templateOwner?: string;
  templateRepo?: string;
  // Resume: skip any step whose external resource already exists (from a prior attempt).
  existing?: {
    githubRepoFullName?: string;
    supabaseProjectRef?: string;
    vercelProjectId?: string;
  };
  // Best-effort per-step persistence. Called after each successful external step so a
  // failed run can be resumed. Must never throw (callers wrap in try/catch too).
  persist?: (patch: {
    provision_step?: string;
    github_repo_url?: string;
    supabase_project_ref?: string;
    supabase_url?: string;
    vercel_project_id?: string;
    vercel_preview_url?: string;
  }) => Promise<void>;
}

export interface ProvisionResult {
  githubRepoUrl: string;
  githubRepoFullName: string;
  vercelProjectId?: string;
  vercelPreviewUrl?: string;
  supabaseProjectRef?: string;
  supabaseUrl?: string;
}

export async function provisionProject(
  params: ProvisionParams,
  onProgress: (event: ProgressEvent) => void,
): Promise<ProvisionResult> {
  const {
    projectName,
    githubToken,
    vercelToken,
    supabaseToken,
    supabaseOrgId,
    supabaseUrl: manualSupabaseUrl,
    supabaseAnonKey: manualAnonKey,
    resendApiKey,
    templateOwner = process.env.GITHUB_TEMPLATE_OWNER ?? "xp-luffy",
    templateRepo = process.env.GITHUB_TEMPLATE_REPO ?? "vibe-stack-supabase",
    existing,
  } = params;

  // Best-effort persistence — never throws, so a persist failure can't abort provisioning.
  async function persistStep(patch: Parameters<NonNullable<ProvisionParams["persist"]>>[0]) {
    try {
      await params.persist?.(patch);
    } catch {
      // Intentionally swallowed: persistence is best-effort.
    }
  }

  // Rollback state
  let githubRepoOwner: string | null = null;
  let githubRepoName: string | null = null;
  let vercelProjectId: string | null = null;
  let supabaseRef: string | null = null;

  async function rollback() {
    if (vercelProjectId && vercelToken) {
      await deleteVercelProject({ token: vercelToken, projectId: vercelProjectId }).catch(() => {});
    }
    if (supabaseRef && supabaseToken) {
      await deleteSupabaseProject(supabaseToken, supabaseRef).catch(() => {});
    }
    if (githubRepoOwner && githubRepoName) {
      await deleteRepo({ token: githubToken, owner: githubRepoOwner, repo: githubRepoName }).catch(() => {});
    }
  }

  try {
    // Step 1: GitHub
    onProgress({ step: "github_start", message: "Creating GitHub repository…" });
    const { login } = await getGithubUser(githubToken);
    let repoUrl = "";
    let repoFullName = "";
    if (existing?.githubRepoFullName) {
      // Resume: a prior attempt already created/found the repo. Reuse it without
      // recreating — and do NOT register it for rollback (we didn't make it this run).
      const existingRepo = await githubClient(githubToken).repos.get({
        owner: existing.githubRepoFullName.split("/")[0],
        repo: existing.githubRepoFullName.split("/").slice(1).join("/"),
      });
      repoUrl = existingRepo.data.html_url;
      repoFullName = existingRepo.data.full_name;
      onProgress({ step: "github_done", message: "Reusing your existing repo ✓", detail: repoUrl });
    } else {
      try {
        ({ repoUrl, repoFullName } = await createRepoFromTemplate({
          token: githubToken,
          templateOwner,
          templateRepo,
          newOwner: login,
          newName: projectName,
          description: "Built with Vibe Launchpad",
          isPrivate: true,
        }));
        // Only repos WE created this run are eligible for rollback deletion.
        githubRepoOwner = login;
        githubRepoName = projectName;
        onProgress({ step: "github_done", message: "GitHub repo created ✓", detail: repoUrl });
      } catch (e) {
        // A prior failed attempt may have left this repo behind — the OAuth token
        // can't delete repos (no delete_repo scope), so rollback couldn't clean it
        // up. Reuse it instead of colliding on "name already exists": makes
        // provisioning idempotent so retries (same name) just pick up the repo.
        const err = e as { status?: number; message?: string };
        const msg = (err?.message ?? "").toLowerCase();
        if (err?.status === 422 || /already exists|name already exists|must be unique/.test(msg)) {
          const existingRepo = await githubClient(githubToken).repos.get({ owner: login, repo: projectName });
          repoUrl = existingRepo.data.html_url;
          repoFullName = existingRepo.data.full_name;
          // Intentionally NOT registered for rollback — we didn't create it this run.
          onProgress({ step: "github_done", message: "Reusing your existing repo ✓", detail: repoUrl });
        } else {
          throw e;
        }
      }
    }
    await persistStep({ provision_step: "github", github_repo_url: repoUrl });

    // Step 2: Supabase (if token provided)
    let resolvedSupabaseUrl = manualSupabaseUrl ?? "";
    let resolvedAnonKey = manualAnonKey ?? "";
    let resolvedSupabaseRef: string | undefined;

    if (supabaseToken && supabaseOrgId) {
      let ref: string;
      if (existing?.supabaseProjectRef) {
        // Resume: a prior attempt already created this Supabase project. Skip
        // creation and just fetch the keys for the existing ref. Do NOT register
        // it for rollback — we didn't create it this run.
        ref = existing.supabaseProjectRef;
        onProgress({ step: "supabase_start", message: "Reusing your existing Supabase database…" });
      } else {
        onProgress({ step: "supabase_start", message: "Creating Supabase database…" });
        ({ ref } = await createSupabaseProject(supabaseToken, {
          orgId: supabaseOrgId,
          name: projectName,
        }));
        supabaseRef = ref;
        onProgress({ step: "supabase_waiting", message: "Waiting for database to be ready… (up to 2 min)" });

        let pollCount = 0;
        await waitForProject(supabaseToken, ref, () => {
          pollCount++;
          onProgress({ step: "supabase_waiting", message: `Database spinning up… (${pollCount * 5}s)` });
        });
      }

      resolvedSupabaseRef = ref;
      const keys = await getProjectKeys(supabaseToken, ref);
      resolvedSupabaseUrl = keys.projectUrl;
      resolvedAnonKey = keys.anonKey;
      onProgress({ step: "supabase_done", message: "Supabase database ready ✓", detail: keys.projectUrl });
      await persistStep({
        provision_step: "supabase",
        supabase_project_ref: ref,
        supabase_url: resolvedSupabaseUrl,
      });

      // Managed email — point the new project's Auth at OnlyAIApp's Resend so
      // signup/confirm/reset emails send for real, with zero member setup.
      if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_DOMAIN) {
        try {
          onProgress({ step: "email_start", message: "Wiring email…" });
          await configureAuthSmtp(supabaseToken, ref, {
            host: "smtp.resend.com",
            port: 465,
            user: "resend",
            pass: process.env.RESEND_API_KEY,
            senderName: projectName,
            adminEmail: `noreply@${process.env.RESEND_FROM_DOMAIN}`,
          });
          onProgress({ step: "email_done", message: "Email ready ✓ — signups send automatically" });
        } catch {
          // Non-fatal: the project still works; the member can connect email later.
        }
      }
    }

    // Step 3: Vercel (optional — GitHub-only onramp skips this)
    let resolvedVercelProjectId: string | undefined;
    let vercelDomain: string | undefined;

    if (vercelToken) {
      let projectId: string;
      if (existing?.vercelProjectId) {
        // Resume: a prior attempt already created this Vercel project. Skip
        // creation and reuse the existing id. Do NOT register it for rollback —
        // we didn't create it this run.
        projectId = existing.vercelProjectId;
        resolvedVercelProjectId = projectId;
        onProgress({ step: "vercel_project_done", message: "Reusing your existing Vercel project ✓" });
      } else {
        onProgress({ step: "vercel_start", message: "Creating Vercel project…" });
        ({ projectId } = await createVercelProject({
          token: vercelToken,
          name: projectName,
          githubRepoFullName: repoFullName,
        }));
        vercelProjectId = projectId;
        resolvedVercelProjectId = projectId;
        onProgress({ step: "vercel_project_done", message: "Vercel project created ✓" });
      }

      // Resolve the real Vercel domain (team accounts use a slug suffix)
      vercelDomain = await getVercelProjectDomain({
        token: vercelToken,
        projectId,
        projectName,
        teamId: undefined, // passed via token scope already
      });

      // Inject env vars
      onProgress({ step: "env_start", message: "Injecting environment variables…" });
      const envVars: Record<string, string> = {
        NEXT_PUBLIC_APP_URL: vercelDomain,
      };
      if (resolvedSupabaseUrl) envVars["NEXT_PUBLIC_SUPABASE_URL"] = resolvedSupabaseUrl;
      if (resolvedAnonKey) envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = resolvedAnonKey;
      if (resendApiKey) envVars["RESEND_API_KEY"] = resendApiKey;
      await addVercelEnvVars({ token: vercelToken, projectId, envVars });
      onProgress({ step: "env_done", message: "Environment variables set ✓" });

      // Actually kick off the first build. Linking a fresh project does NOT
      // always trigger a deploy on its own (the initial push predates the
      // git connection), so we trigger it explicitly. Non-fatal: if this
      // fails, Vercel's GitHub webhook still fires on the next push.
      onProgress({ step: "deploy_start", message: "Triggering first deployment…" });
      await triggerVercelDeployment({ token: vercelToken, projectId, projectName }).catch(() => {});
      onProgress({ step: "deploy_done", message: "Deployment started ✓ — building on Vercel" });
      await persistStep({
        provision_step: "vercel",
        vercel_project_id: resolvedVercelProjectId,
        vercel_preview_url: vercelDomain,
      });
    } else {
      onProgress({ step: "github_only", message: "Repo ready — connect Vercel later to deploy." });
    }

    await persistStep({ provision_step: "done" });

    return {
      githubRepoUrl: repoUrl,
      githubRepoFullName: repoFullName,
      vercelProjectId: resolvedVercelProjectId,
      vercelPreviewUrl: vercelDomain,
      supabaseProjectRef: resolvedSupabaseRef ?? undefined,
      supabaseUrl: resolvedSupabaseUrl || undefined,
    };
  } catch (err) {
    await rollback();
    throw err;
  }
}
