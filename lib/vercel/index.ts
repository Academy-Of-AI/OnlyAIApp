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
}): Promise<{ deploymentId: string | null; url: string | null; state: DeploymentState }> {
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
    return { deploymentId: null, url: null, state: "unknown" };
  }
  const data = await res.json() as { id?: string; url?: string; readyState?: string };
  const raw = (data.readyState ?? "QUEUED").toUpperCase();
  const state = (["READY", "BUILDING", "ERROR", "QUEUED", "CANCELED", "INITIALIZING"].includes(raw)
    ? raw : "unknown") as DeploymentState;
  return {
    deploymentId: data.id ?? null,
    url: data.url ? `https://${data.url}` : null,
    state,
  };
}

/**
 * Poll a single deployment by id for its current build state. Used by the
 * build pipeline to report a TRUTHFUL outcome (deployed vs build-failed)
 * instead of claiming success the instant a deploy is triggered.
 */
export async function getDeploymentById({
  token,
  deploymentId,
  teamId,
}: {
  token: string;
  deploymentId: string;
  teamId?: string;
}): Promise<{ state: DeploymentState; url: string | null }> {
  try {
    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
    const res = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}${qs}`, {
      headers: vercelHeaders(token),
    });
    if (!res.ok) return { state: "unknown", url: null };
    const d = await res.json() as { readyState?: string; state?: string; url?: string };
    const raw = (d.readyState ?? d.state ?? "unknown").toUpperCase();
    const state = (["READY", "BUILDING", "ERROR", "QUEUED", "CANCELED", "INITIALIZING"].includes(raw)
      ? raw : "unknown") as DeploymentState;
    return { state, url: d.url ? `https://${d.url}` : null };
  } catch {
    return { state: "unknown", url: null };
  }
}

export type DeploymentState =
  | "READY" | "BUILDING" | "ERROR" | "QUEUED" | "CANCELED" | "INITIALIZING" | "unknown";

export interface LatestDeployment {
  state: DeploymentState;
  url: string | null;
  commitMessage: string | null;
  createdAt: number | null;
  deploymentId: string | null;
}

/**
 * Get the latest deployment for a project (any state) so Mission Control can
 * show live status: READY / BUILDING / ERROR / etc.
 */
export async function getLatestDeploymentStatus({
  token,
  projectId,
  teamId,
}: {
  token: string;
  projectId: string;
  teamId?: string;
}): Promise<LatestDeployment> {
  const empty: LatestDeployment = {
    state: "unknown", url: null, commitMessage: null, createdAt: null, deploymentId: null,
  };
  try {
    const qs = `projectId=${encodeURIComponent(projectId)}&limit=1${teamId ? `&teamId=${encodeURIComponent(teamId)}` : ""}`;
    const res = await fetch(`${VERCEL_API}/v6/deployments?${qs}`, {
      headers: vercelHeaders(token),
    });
    if (!res.ok) return empty;
    const data = await res.json() as {
      deployments?: Array<{
        uid?: string; url?: string; state?: string; readyState?: string;
        created?: number; meta?: { githubCommitMessage?: string };
      }>;
    };
    const d = data.deployments?.[0];
    if (!d) return empty;
    const raw = (d.state ?? d.readyState ?? "unknown").toUpperCase();
    const state = (["READY", "BUILDING", "ERROR", "QUEUED", "CANCELED", "INITIALIZING"].includes(raw)
      ? raw : "unknown") as DeploymentState;
    return {
      state,
      url: d.url ? `https://${d.url}` : null,
      commitMessage: d.meta?.githubCommitMessage ?? null,
      createdAt: d.created ?? null,
      deploymentId: d.uid ?? null,
    };
  } catch {
    return empty;
  }
}

/**
 * Fetch a failed deployment's build logs and extract the single most useful
 * error line, in plain-ish English. Heuristic (no LLM) so it's cheap to call
 * on a server-rendered page. Returns null if nothing useful is found.
 */
export async function getDeploymentErrorLine({
  token,
  deploymentId,
  teamId,
}: {
  token: string;
  deploymentId: string;
  teamId?: string;
}): Promise<string | null> {
  try {
    const qs = `${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`;
    const res = await fetch(`${VERCEL_API}/v2/deployments/${deploymentId}/events${qs}`, {
      headers: vercelHeaders(token),
    });
    if (!res.ok) return null;
    const events = await res.json() as Array<{ text?: string; payload?: { text?: string } }>;
    const lines = (Array.isArray(events) ? events : [])
      .map((e) => (e.text ?? e.payload?.text ?? "").replace(/\[[0-9;]*m/g, "").trim())
      .filter(Boolean);

    // Prefer the most specific signal, in priority order
    const patterns = [
      /Type error:.*/i,
      /Module not found:.*/i,
      /Error:\s*.*(required|missing|undefined|not found|cannot).*/i,
      /Failed to compile/i,
      /Error:.*/i,
    ];
    for (const re of patterns) {
      const hit = lines.find((l) => re.test(l));
      if (hit) return hit.slice(0, 180);
    }
    return null;
  } catch {
    return null;
  }
}

export interface VercelEnvVar { key: string; target: string[]; type: string }

/**
 * List a project's environment variables (keys + targets only — Vercel never
 * returns decrypted secret values, which is what we want).
 */
export async function listVercelEnvVars({
  token, projectId, teamId,
}: { token: string; projectId: string; teamId?: string }): Promise<VercelEnvVar[]> {
  try {
    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
    const res = await fetch(`${VERCEL_API}/v9/projects/${projectId}/env${qs}`, {
      headers: vercelHeaders(token),
    });
    if (!res.ok) return [];
    const data = await res.json() as { envs?: Array<{ key: string; target?: string[] | string; type: string }> };
    return (data.envs ?? []).map((e) => ({
      key: e.key,
      target: Array.isArray(e.target) ? e.target : e.target ? [e.target] : [],
      type: e.type,
    }));
  } catch { return []; }
}

/**
 * Create or update a single env var (upsert) across all targets.
 */
export async function upsertVercelEnvVar({
  token, projectId, key, value, teamId,
  targets = ["production", "preview", "development"],
}: {
  token: string; projectId: string; key: string; value: string; teamId?: string; targets?: string[];
}): Promise<void> {
  const qs = `?upsert=true${teamId ? `&teamId=${encodeURIComponent(teamId)}` : ""}`;
  const res = await fetch(`${VERCEL_API}/v10/projects/${projectId}/env${qs}`, {
    method: "POST",
    headers: vercelHeaders(token),
    body: JSON.stringify({ key, value, type: "encrypted", target: targets }),
  });
  if (!res.ok) throw new Error(`Vercel set env failed: ${await res.text()}`);
}

/**
 * Roll back to the previous successful production deployment by re-deploying
 * its exact commit SHA. Uses the same /v13/deployments path proven to work,
 * so it doesn't depend on a less-stable promote endpoint.
 */
export async function rollbackVercelProject({
  token, projectId, projectName, teamId,
}: {
  token: string; projectId: string; projectName: string; teamId?: string;
}): Promise<{ ok: boolean; sha?: string; message?: string }> {
  try {
    const qs = `projectId=${encodeURIComponent(projectId)}&limit=10&target=production${teamId ? `&teamId=${encodeURIComponent(teamId)}` : ""}`;
    const res = await fetch(`${VERCEL_API}/v6/deployments?${qs}`, { headers: vercelHeaders(token) });
    if (!res.ok) return { ok: false, message: "Could not list deployments." };
    const data = await res.json() as {
      deployments?: Array<{ state?: string; readyState?: string; meta?: { githubCommitSha?: string } }>;
    };
    const all = data.deployments ?? [];
    // Skip the latest; find the most recent prior READY deploy with a commit SHA.
    const prev = all.slice(1).find(
      (d) => (d.state ?? d.readyState) === "READY" && d.meta?.githubCommitSha,
    );
    if (!prev?.meta?.githubCommitSha) {
      return { ok: false, message: "No earlier successful deploy to roll back to." };
    }
    const sha = prev.meta.githubCommitSha;
    const tq = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
    const dep = await fetch(`${VERCEL_API}/v13/deployments${tq}`, {
      method: "POST",
      headers: vercelHeaders(token),
      body: JSON.stringify({
        name: projectName, project: projectId, target: "production",
        gitSource: { type: "github", ref: sha },
      }),
    });
    if (!dep.ok) return { ok: false, message: await dep.text() };
    return { ok: true, sha: sha.slice(0, 7) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Rollback failed." };
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
