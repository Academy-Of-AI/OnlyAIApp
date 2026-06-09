import { randomUUID } from "crypto";

const BASE = "https://api.supabase.com/v1";

function mgmtHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Map a raw Supabase Management API error body into a short, member-friendly
 * message. The raw bodies are JSON blobs or stack-y strings we don't want to
 * surface verbatim, so we pull out the common provisioning failures.
 */
function friendlySupabaseError(action: "create" | "health", raw: string): string {
  const r = raw.toLowerCase();
  if (action === "health") {
    return "Your Supabase database is taking longer than usual to come online. It will keep provisioning in the background — give it a minute, then refresh your project.";
  }
  if (/free.*tier|project limit|maximum number of projects|quota|too many projects/.test(r)) {
    return "Your Supabase organization has reached its project limit. Delete an unused project or upgrade your Supabase plan, then try again.";
  }
  if (/unauthor|invalid token|forbidden|401|403/.test(r)) {
    return "Supabase wouldn't let us create the database — your connection may have expired. Reconnect Supabase and try again.";
  }
  if (/name|already exists|duplicate/.test(r)) {
    return "A Supabase project with that name already exists in your organization. Pick a different project name.";
  }
  return "We couldn't create your Supabase database right now. Please try again in a moment.";
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
      organization_id: orgId,
      name,
      db_pass: dbPass,
      region,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(friendlySupabaseError("create", err));
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

  throw new Error(friendlySupabaseError("health", `project ${ref} health-timeout`));
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

  const keys = await res.json() as Array<{ name?: string; type?: string; api_key?: string; api_key_id?: string }>;

  // Supabase is migrating from legacy JWT keys (name "anon"/"service_role") to a
  // new publishable/secret format ("sb_publishable_…"). The client only ever
  // needs the *public* key, so accept either: legacy "anon", or a publishable
  // key (matched by type or name). Never accept a secret/service_role key.
  const isPublic = (k: { name?: string; type?: string }) => {
    const n = (k.name ?? "").toLowerCase();
    const t = (k.type ?? "").toLowerCase();
    return n === "anon" || n === "publishable" || t === "publishable" || t === "anon";
  };
  const publicEntry = keys.find(isPublic);
  const anonKey = publicEntry?.api_key ?? "";

  // IMPORTANT: do NOT throw here. By the time we fetch keys, the GitHub repo and
  // Supabase project already exist. Throwing would abort provisioning and roll
  // everything back over a non-fatal key-shape mismatch. Instead, return an
  // empty anon key — the project is still usable; the member can paste the
  // publishable key from their Supabase dashboard if it wasn't auto-injected.
  return {
    projectUrl: `https://${ref}.supabase.co`,
    anonKey,
  };
}

/**
 * Point a project's Auth emails (signup / confirm / magic-link / reset) at a
 * custom SMTP provider, so the member's app sends real, branded email out of
 * the box instead of Supabase's rate-limited default. Used for managed email.
 */
export async function configureAuthSmtp(
  token: string,
  ref: string,
  opts: { host: string; port: number; user: string; pass: string; senderName: string; adminEmail: string },
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: mgmtHeaders(token),
    body: JSON.stringify({
      smtp_host: opts.host,
      smtp_port: String(opts.port),
      smtp_user: opts.user,
      smtp_pass: opts.pass,
      smtp_sender_name: opts.senderName,
      smtp_admin_email: opts.adminEmail,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Auth SMTP config failed: ${err}`);
  }
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
