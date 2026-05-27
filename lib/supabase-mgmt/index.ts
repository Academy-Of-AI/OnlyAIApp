import { randomUUID } from "crypto";

const BASE = "https://api.supabase.com/v1";

function mgmtHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function listOrganizations(
  token: string,
): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${BASE}/organizations`, {
    headers: mgmtHeaders(token),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list Supabase organizations: ${err}`);
  }
  return res.json() as Promise<Array<{ id: string; name: string }>>;
}

export async function createSupabaseProject(
  token: string,
  opts: {
    orgId: string;
    name: string;
    region?: string;
  },
): Promise<{ ref: string }> {
  const { orgId, name, region = "ap-southeast-1" } = opts;
  // db_pass must meet Supabase complexity requirements
  const dbPass = randomUUID().replace(/-/g, "") + "Aa1!";

  const res = await fetch(`${BASE}/projects`, {
    method: "POST",
    headers: mgmtHeaders(token),
    body: JSON.stringify({
      org_id: orgId,
      name,
      db_pass: dbPass,
      region,
      plan: "free",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create Supabase project: ${err}`);
  }

  const data = await res.json() as { ref: string };
  return { ref: data.ref };
}

export async function waitForProject(
  token: string,
  ref: string,
  onPoll?: () => void,
): Promise<void> {
  const timeoutMs = 180_000;
  const intervalMs = 5_000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE}/projects/${ref}`, {
      headers: mgmtHeaders(token),
    });

    if (res.ok) {
      const data = await res.json() as { status: string };
      if (data.status === "ACTIVE_HEALTHY") return;
    }

    onPoll?.();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Supabase project ${ref} did not become healthy within 180 seconds`,
  );
}

export async function getProjectKeys(
  token: string,
  ref: string,
): Promise<{ projectUrl: string; anonKey: string }> {
  const res = await fetch(`${BASE}/projects/${ref}/api-keys`, {
    headers: mgmtHeaders(token),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get Supabase project keys: ${err}`);
  }

  const keys = await res.json() as Array<{ name: string; api_key: string }>;
  const anonEntry = keys.find((k) => k.name === "anon");

  if (!anonEntry) {
    throw new Error("Could not find anon key for Supabase project");
  }

  return {
    projectUrl: `https://${ref}.supabase.co`,
    anonKey: anonEntry.api_key,
  };
}

export async function deleteSupabaseProject(
  token: string,
  ref: string,
): Promise<void> {
  try {
    await fetch(`${BASE}/projects/${ref}`, {
      method: "DELETE",
      headers: mgmtHeaders(token),
    });
  } catch {
    // best-effort, swallow errors
  }
}

export async function runMigration(
  token: string,
  ref: string,
  sql: string,
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${ref}/database/query`, {
    method: "POST",
    headers: mgmtHeaders(token),
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Migration failed: ${err}`);
  }
}
