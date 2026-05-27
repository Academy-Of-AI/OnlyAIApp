import { createRepoFromTemplate, deleteRepo, getGithubUser } from "@/lib/github";
import {
  createSupabaseProject,
  deleteSupabaseProject,
  getProjectKeys,
  waitForProject,
} from "@/lib/supabase-mgmt";
import { addVercelEnvVars, createVercelProject, deleteVercelProject } from "@/lib/vercel";

export type ProgressEvent = {
  step: string;      // e.g. "github_done"
  message: string;   // human-readable e.g. "GitHub repo created ✓"
  detail?: string;   // optional sub-detail
};

export interface ProvisionParams {
  projectName: string;
  githubToken: string;
  vercelToken: string;
  supabaseToken?: string;    // optional — if not provided, skip Supabase auto-provision
  supabaseOrgId?: string;
  supabaseUrl?: string;      // manual override (legacy)
  supabaseAnonKey?: string;  // manual override (legacy)
  templateOwner?: string;
  templateRepo?: string;
}

export interface ProvisionResult {
  githubRepoUrl: string;
  githubRepoFullName: string;
  vercelProjectId: string;
  vercelPreviewUrl: string;
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
    templateOwner = process.env.GITHUB_TEMPLATE_OWNER ?? "xp-luffy",
    templateRepo = process.env.GITHUB_TEMPLATE_REPO ?? "vibe-stack-supabase",
  } = params;

  // Rollback state
  let githubRepoOwner: string | null = null;
  let githubRepoName: string | null = null;
  let vercelProjectId: string | null = null;
  let supabaseRef: string | null = null;

  async function rollback() {
    if (vercelProjectId) {
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
    const { repoUrl, repoFullName } = await createRepoFromTemplate({
      token: githubToken,
      templateOwner,
      templateRepo,
      newOwner: login,
      newName: projectName,
      description: "Built with Vibe Launchpad",
      isPrivate: true,
    });
    githubRepoOwner = login;
    githubRepoName = projectName;
    onProgress({ step: "github_done", message: "GitHub repo created ✓", detail: repoUrl });

    // Step 2: Supabase (if token provided)
    let resolvedSupabaseUrl = manualSupabaseUrl ?? "";
    let resolvedAnonKey = manualAnonKey ?? "";

    if (supabaseToken && supabaseOrgId) {
      onProgress({ step: "supabase_start", message: "Creating Supabase database…" });
      const { ref } = await createSupabaseProject(supabaseToken, {
        orgId: supabaseOrgId,
        name: projectName,
      });
      supabaseRef = ref;
      onProgress({ step: "supabase_waiting", message: "Waiting for database to be ready… (up to 2 min)" });

      let pollCount = 0;
      await waitForProject(supabaseToken, ref, () => {
        pollCount++;
        onProgress({ step: "supabase_waiting", message: `Database spinning up… (${pollCount * 5}s)` });
      });

      const keys = await getProjectKeys(supabaseToken, ref);
      resolvedSupabaseUrl = keys.projectUrl;
      resolvedAnonKey = keys.anonKey;
      onProgress({ step: "supabase_done", message: "Supabase database ready ✓", detail: keys.projectUrl });
    }

    // Step 3: Vercel
    onProgress({ step: "vercel_start", message: "Creating Vercel project…" });
    const { projectId } = await createVercelProject({
      token: vercelToken,
      name: projectName,
      githubRepoFullName: repoFullName,
    });
    vercelProjectId = projectId;
    onProgress({ step: "vercel_project_done", message: "Vercel project created ✓" });

    // Step 4: Inject env vars
    onProgress({ step: "env_start", message: "Injecting environment variables…" });
    const envVars: Record<string, string> = {
      NEXT_PUBLIC_APP_URL: `https://${projectName}.vercel.app`,
    };
    if (resolvedSupabaseUrl) envVars["NEXT_PUBLIC_SUPABASE_URL"] = resolvedSupabaseUrl;
    if (resolvedAnonKey) envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = resolvedAnonKey;
    await addVercelEnvVars({ token: vercelToken, projectId, envVars });
    onProgress({ step: "env_done", message: "Environment variables set ✓" });

    // Step 5: Done
    onProgress({ step: "deploy_start", message: "Triggering first deployment…" });

    return {
      githubRepoUrl: repoUrl,
      githubRepoFullName: repoFullName,
      vercelProjectId: projectId,
      vercelPreviewUrl: `https://${projectName}.vercel.app`,
      supabaseProjectRef: supabaseRef ?? undefined,
      supabaseUrl: resolvedSupabaseUrl || undefined,
    };
  } catch (err) {
    await rollback();
    throw err;
  }
}
