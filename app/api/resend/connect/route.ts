import { encrypt } from "@/lib/crypto";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/resend/connect
 * Validates a Resend API key and stores it encrypted.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await request.json() as { token: string };
  if (!token?.startsWith("re_")) {
    return NextResponse.json(
      { error: "Invalid key — Resend API keys start with re_" },
      { status: 400 },
    );
  }

  // Validate key against Resend API
  const check = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!check.ok) {
    return NextResponse.json(
      { error: "Invalid API key — please check and try again." },
      { status: 400 },
    );
  }

  // Store encrypted
  const encryptedToken = await encrypt(token);
  await supabase.from("oauth_connections").upsert({
    user_id: user.id,
    provider: "resend",
    access_token: encryptedToken,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
