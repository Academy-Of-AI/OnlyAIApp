import { Octokit } from "@octokit/rest";

export function githubClient(token: string) {
  return new Octokit({ auth: token });
}

/**
 * Create a new repo for the user by generating from a template.
 */
export async function createRepoFromTemplate({
  token,
  templateOwner,
  templateRepo,
  newOwner,
  newName,
  description = "",
  isPrivate = true,
}: {
  token: string;
  templateOwner: string;
  templateRepo: string;
  newOwner: string;
  newName: string;
  description?: string;
  isPrivate?: boolean;
}) {
  const octokit = githubClient(token);

  const { data } = await octokit.request(
    "POST /repos/{template_owner}/{template_repo}/generate",
    {
      template_owner: templateOwner,
      template_repo: templateRepo,
      owner: newOwner,
      name: newName,
      description,
      private: isPrivate,
      include_all_branches: false,
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
    },
  );

  return {
    repoUrl: data.html_url,
    repoFullName: data.full_name,  // "owner/repo"
    defaultBranch: data.default_branch ?? "main",
    repoId: data.id,
  };
}

/**
 * Get the authenticated user's GitHub login.
 */
export async function getGithubUser(token: string) {
  const octokit = githubClient(token);
  const { data } = await octokit.users.getAuthenticated();
  return { login: data.login, avatarUrl: data.avatar_url, id: data.id };
}

/**
 * Rename a GitHub repository.
 * Returns the new repo URL and full name.
 */
export async function renameRepo({
  token,
  owner,
  repo,
  newName,
}: {
  token: string;
  owner: string;
  repo: string;
  newName: string;
}): Promise<{ repoUrl: string; repoFullName: string }> {
  const octokit = githubClient(token);
  const { data } = await octokit.repos.update({ owner, repo, name: newName });
  return { repoUrl: data.html_url, repoFullName: data.full_name };
}

/**
 * Create or update a single file in a repo (handles the required SHA for updates).
 */
export async function upsertFile({
  token, owner, repo, path, content, message,
}: {
  token: string; owner: string; repo: string; path: string; content: string; message: string;
}): Promise<void> {
  const octokit = githubClient(token);
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if ("sha" in data) sha = data.sha as string;
  } catch { /* file doesn't exist yet */ }
  await octokit.repos.createOrUpdateFileContents({
    owner, repo, path, message,
    content: Buffer.from(content).toString("base64"),
    ...(sha ? { sha } : {}),
  });
}

/**
 * Register a push webhook on a repo (idempotent — skips if one already points
 * at the same callback URL).
 */
export async function registerPushWebhook({
  token, owner, repo, callbackUrl, secret,
}: {
  token: string; owner: string; repo: string; callbackUrl: string; secret?: string;
}): Promise<void> {
  const octokit = githubClient(token);
  try {
    const { data: hooks } = await octokit.repos.listWebhooks({ owner, repo });
    if (hooks.some((h) => h.config?.url === callbackUrl)) return;
  } catch { /* listing may fail on fresh repos — proceed to create */ }
  await octokit.repos.createWebhook({
    owner, repo,
    config: { url: callbackUrl, content_type: "json", ...(secret ? { secret } : {}) },
    events: ["push"],
    active: true,
  });
}

/**
 * Delete a GitHub repository — best-effort, swallow errors.
 */
export async function deleteRepo({
  token,
  owner,
  repo,
}: {
  token: string;
  owner: string;
  repo: string;
}): Promise<void> {
  try {
    const octokit = githubClient(token);
    await octokit.repos.delete({ owner, repo });
  } catch { /* ignore */ }
}
