import { encrypt } from "@/lib/crypto";
import { listOrganizations } from "@/lib/supabase-mgmt";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/supabase/connect
 *
 * Phase 1 — body: { token: string }
 *   Validates token, returns { orgs: [{ id, name }] }
 *
 * Phase 2 — body: { token: string, orgId: string }
 *   Stores encrypted connection, returns { ok: true }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { token?: string; orgId?: string };
  const { token, orgId } = body;

  if (!token?.trim()) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  // Validate token by listing organizations
  let orgs: Array<{ id: string; name: string }>;
  try {
    orgs = await listOrganizations(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  // Phase 1: just return org list
  if (!orgId) {
    return NextResponse.json({ orgs });
  }

  // Phase 2: store encrypted connection
  const selectedOrg = orgs.find((o) => o.id === orgId);
  if (!selectedOrg) {
    return NextResponse.json({ error: "Organization not found" }, { status: 400 });
  }

  const encryptedToken = await encrypt(token);

  await supabase.from("oauth_connections").upsert({
    user_id: user.id,
    provider: "supabase",
    access_token: encryptedToken,
    metadata: { org_id: selectedOrg.id, org_name: selectedOrg.name },
  });

  return NextResponse.json({ ok: true });
}
