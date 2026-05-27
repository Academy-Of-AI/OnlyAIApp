import { encrypt } from "@/lib/crypto";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/vercel/connect
 * Body: { token: string }
 * Validates a Vercel personal access token and stores it encrypted.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await request.json() as { token?: string };
  if (!token?.trim()) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  // Validate token by calling Vercel API
  const res = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Invalid Vercel token" }, { status: 400 });
  }

  const vercelUser = await res.json() as { user?: { id: string; username: string } };
  const encryptedToken = await encrypt(token);

  await supabase.from("oauth_connections").upsert({
    user_id: user.id,
    provider: "vercel",
    access_token: encryptedToken,
    provider_user_id: vercelUser.user?.id,
    metadata: { username: vercelUser.user?.username },
  });

  await track("vercel_connected", user.id, { vercel_username: vercelUser.user?.username });
  return NextResponse.json({ ok: true, username: vercelUser.user?.username });
}
