import { Octokit } from "@octokit/rest";

export function githubClient(token: string) {
  return new Octokit({ auth: token });
}

/**
 * Turn a raw Octokit/GitHub API error into a short, member-friendly message.
 * GitHub returns terse, low-level strings ("name already exists on this
 * account", validation arrays, 403s) that aren't safe to surface verbatim, so
 * we map the common provisioning failures to plain English and fall back to a
 * generic message otherwise.
 */
export function friendlyGithubError(err: unknown, repoName?: string): string {
  const e = err as { status?: number; message?: string; response?: { data?: { errors?: Array<{ message?: string }> } } };
  const status = e?.status;
  const raw = [
    e?.message ?? "",
    ...(e?.response?.data?.errors ?? []).map((x) => x?.message ?? ""),
  ].join(" ").toLowerCase();

  // Repo name already taken on the account
  if (status === 422 || /already exists|name already exists|must be unique/.test(raw)) {
    return repoName
      ? `A repository named "${repoName}" already exists on your GitHub account. Pick a different project name.`
      : "That repository name is already taken on your GitHub account. Pick a different project name.";
  }
  // Org/account is full or over its private-repo limit
  if (/over your plan|repository limit|exceeded|too many repositories|account.*full/.test(raw)) {
    return "Your GitHub account has hit its repository limit. Free up a slot or upgrade your GitHub plan, then try again.";
  }
  // Token can't create repos (missing scope, SSO not authorized, expired)
  if (status === 401 || status === 403 || /bad credentials|requires authentication|not accessible|sso/.test(raw)) {
    return "GitHub wouldn't let us create the repo — your connection may have expired or be missing the 'repo' permission. Reconnect GitHub and try again.";
  }
  // Template missing/renamed
  if (status === 404 || /not found/.test(raw)) {
    return "We couldn't find the project template on GitHub. This is on us — please try again shortly.";
  }
  return "GitHub couldn't create the repository right now. Please try again in a moment.";
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

  let data;
  try {
    ({ data } = await octokit.request(
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
    ));
  } catch (err) {
    throw new Error(friendlyGithubError(err, newName));
  }

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
 * The git identity a handed-off project MUST commit with, or Vercel blocks the
 * deploy: "commit email could not be matched to a GitHub account."
 *
 * Vercel verifies that the commit author's email belongs to a GitHub account
 * with access to the repo. A user's machine git email (e.g. a personal address)
 * often isn't on their GitHub account, so local commits made by Claude Code
 * after handoff get blocked. The account's GitHub `noreply` email
 * (`<id>+<login>@users.noreply.github.com`) is ALWAYS associated with the
 * account, so we hand that back to use as the commit identity.
 */
export async function getCommitIdentity(token: string): Promise<{ email: string; name: string }> {
  const { login, id } = await getGithubUser(token);
  return { email: `${id}+${login}@users.noreply.github.com`, name: login };
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
  token, owner, repo, path, content, message, author, committer,
}: {
  token: string; owner: string; repo: string; path: string; content: string; message: string;
  // Optional commit identity. Set this to the account's GitHub noreply email so
  // Vercel can match the commit author to the repo owner (otherwise it blocks the
  // deploy — see provisionProject's deploy-identity bind).
  author?: { name: string; email: string };
  committer?: { name: string; email: string };
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
    ...(author ? { author } : {}),
    ...(committer ? { committer } : {}),
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
