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
