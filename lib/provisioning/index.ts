import { createRepoFromTemplate, getGithubUser } from "@/lib/github";
import { addVercelEnvVars, createVercelProject } from "@/lib/vercel";

export interface ProvisionParams {
  projectName: string;
  githubToken: string;
  vercelToken: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  templateOwner?: string;
  templateRepo?: string;
}

export interface ProvisionResult {
  githubRepoUrl: string;
  githubRepoFullName: string;
  vercelProjectId: string;
  vercelPreviewUrl: string | null;
}

/**
 * Full provisioning flow:
 *   1. Create GitHub repo from template
 *   2. Create Vercel project linked to repo
 *   3. Inject env vars into Vercel
 *
 * Returns URLs for both services.
 */
export async function provisionProject(params: ProvisionParams): Promise<ProvisionResult> {
  const {
    projectName,
    githubToken,
    vercelToken,
    supabaseUrl = "",
    supabaseAnonKey = "",
    templateOwner = process.env.GITHUB_TEMPLATE_OWNER ?? "xp-luffy",
    templateRepo = process.env.GITHUB_TEMPLATE_REPO ?? "vibe-stack-supabase",
  } = params;

  // Step 1 — GitHub: create repo from template
  const { login } = await getGithubUser(githubToken);

  const { repoUrl, repoFullName } = await createRepoFromTemplate({
    token: githubToken,
    templateOwner,
    templateRepo,
    newOwner: login,
    newName: projectName,
    description: `Built with Vibe Launchpad`,
    isPrivate: true,
  });

  // Step 2 — Vercel: create project linked to GitHub repo
  const { projectId } = await createVercelProject({
    token: vercelToken,
    name: projectName,
    githubRepoFullName: repoFullName,
  });

  // Step 3 — Vercel: inject env vars
  const envVars: Record<string, string> = {
    NEXT_PUBLIC_APP_URL: `https://${projectName}.vercel.app`,
  };
  if (supabaseUrl) envVars["NEXT_PUBLIC_SUPABASE_URL"] = supabaseUrl;
  if (supabaseAnonKey) envVars["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = supabaseAnonKey;

  await addVercelEnvVars({ token: vercelToken, projectId, envVars });

  return {
    githubRepoUrl: repoUrl,
    githubRepoFullName: repoFullName,
    vercelProjectId: projectId,
    // First deploy takes ~60s; user can check dashboard
    vercelPreviewUrl: `https://${projectName}.vercel.app`,
  };
}
