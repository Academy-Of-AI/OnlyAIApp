const VERCEL_API = "https://api.vercel.com";

function vercelHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Create a Vercel project linked to a GitHub repo.
 */
export async function createVercelProject({
  token,
  name,
  githubRepoFullName,
  framework = "nextjs",
}: {
  token: string;
  name: string;
  githubRepoFullName: string;
  framework?: string;
}) {
  const res = await fetch(`${VERCEL_API}/v9/projects`, {
    method: "POST",
    headers: vercelHeaders(token),
    body: JSON.stringify({
      name,
      framework,
      gitRepository: {
        type: "github",
        repo: githubRepoFullName,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel createProject failed: ${err}`);
  }

  const data = await res.json() as { id: string; name: string; link?: { repoId?: number } };
  return { projectId: data.id, projectName: data.name };
}

/**
 * Add environment variables to a Vercel project.
 */
export async function addVercelEnvVars({
  token,
  projectId,
  envVars,
  targets = ["production", "preview", "development"],
}: {
  token: string;
  projectId: string;
  envVars: Record<string, string>;
  targets?: string[];
}) {
  const body = Object.entries(envVars).map(([key, value]) => ({
    key,
    value,
    type: "encrypted",
    target: targets,
  }));

  const res = await fetch(`${VERCEL_API}/v10/projects/${projectId}/env`, {
    method: "POST",
    headers: vercelHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel addEnvVars failed: ${err}`);
  }
}

/**
 * Get the latest deployment URL for a project.
 */
export async function getLatestDeploymentUrl({
  token,
  projectId,
}: {
  token: string;
  projectId: string;
}): Promise<string | null> {
  const res = await fetch(
    `${VERCEL_API}/v6/deployments?projectId=${projectId}&limit=1&state=READY`,
    { headers: vercelHeaders(token) },
  );
  if (!res.ok) return null;
  const data = await res.json() as { deployments?: Array<{ url: string }> };
  const url = data.deployments?.[0]?.url;
  return url ? `https://${url}` : null;
}

/**
 * Rename a Vercel project. Returns the new domain.
 */
export async function renameVercelProject({
  token,
  projectId,
  newName,
  teamId,
}: {
  token: string;
  projectId: string;
  newName: string;
  teamId?: string;
}): Promise<string> {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const res = await fetch(`${VERCEL_API}/v9/projects/${projectId}${qs}`, {
    method: "PATCH",
    headers: vercelHeaders(token),
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel renameProject failed: ${err}`);
  }
  const data = await res.json() as { domains?: string[] };
  const prod = (data.domains ?? [])
    .filter((d) => !d.includes("-git-"))
    .sort((a, b) => a.length - b.length)[0];
  return prod ? `https://${prod}` : `https://${newName}.vercel.app`;
}

/**
 * Get the production domain(s) assigned to a Vercel project.
 * Returns the shortest/cleanest one, e.g. "aoai-hrdc-xienpuo-9035s-projects.vercel.app".
 * Falls back to the guessed pattern if the API call fails.
 */
export async function getVercelProjectDomain({
  token,
  projectId,
  projectName,
  teamId,
}: {
  token: string;
  projectId: string;
  projectName: string;
  teamId?: string;
}): Promise<string> {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  try {
    const res = await fetch(`${VERCEL_API}/v9/projects/${projectId}${qs}`, {
      headers: vercelHeaders(token),
    });
    if (res.ok) {
      const data = await res.json() as { domains?: string[] };
      // Pick the shortest non-git-branch domain (production alias)
      const prod = (data.domains ?? [])
        .filter((d) => !d.includes("-git-"))
        .sort((a, b) => a.length - b.length)[0];
      if (prod) return `https://${prod}`;
    }
  } catch { /* fall through to guess */ }
  return `https://${projectName}.vercel.app`;
}

/**
 * Trigger a new deployment for a Vercel project via its linked GitHub branch.
 * Non-fatal: if the API call fails, Vercel's GitHub webhook will still fire
 * when it receives the push event (may just take a few extra seconds).
 */
export async function triggerVercelDeployment({
  token,
  projectId,
  projectName,
  branch = "main",
  teamId,
}: {
  token: string;
  projectId: string;
  projectName: string;
  branch?: string;
  teamId?: string;
}): Promise<void> {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const res = await fetch(`${VERCEL_API}/v13/deployments${qs}`, {
    method: "POST",
    headers: vercelHeaders(token),
    body: JSON.stringify({
      name: projectName,
      project: projectId,
      gitSource: { type: "github", ref: branch },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.warn(`[vercel] triggerDeployment non-fatal: ${err}`);
  }
}

/**
 * Delete a Vercel project — best-effort, swallow errors.
 */
export async function deleteVercelProject({
  token,
  projectId,
}: {
  token: string;
  projectId: string;
}): Promise<void> {
  try {
    await fetch(`${VERCEL_API}/v9/projects/${projectId}`, {
      method: "DELETE",
      headers: vercelHeaders(token),
    });
  } catch { /* ignore */ }
}
