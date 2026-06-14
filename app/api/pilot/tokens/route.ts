import { createClient } from "@/lib/supabase/server";
import { isProUser } from "@/lib/plan";
import { generateToken } from "@/lib/pilot/api/tokens";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Manage a user's Pilot API tokens (the Settings "Pilot in your terminal" panel).
 * Uses the RLS-scoped USER client — the `own api tokens` policy means a user can
 * only ever insert/read/revoke their OWN rows; no service-role needed here.
 *
 * POST   → mint (Pro only). Returns the plaintext ONCE; only the hash is stored.
 * DELETE → revoke by id (soft: sets revoked_at, so the gate rejects it next call).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Minting is a Pro action — free/core see the upgrade CTA, not this button.
  if (!(await isProUser(supabase, user.id))) {
    return NextResponse.json({ error: "Pilot in your terminal is a Pro feature.", code: "pro_required" }, { status: 402 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = (typeof body.name === "string" && body.name.trim() ? body.name.trim() : "cli").slice(0, 48);

  const { token, hash, lastFour } = generateToken();
  const { error } = await supabase.from("api_tokens").insert({
    user_id: user.id, name, token_hash: hash, last_four: lastFour,
  });
  if (error) {
    console.error("[pilot/tokens] mint failed:", error.message);
    return NextResponse.json({ error: "Couldn't create a token — please try again." }, { status: 500 });
  }
  // Plaintext returned ONCE — never retrievable again.
  return NextResponse.json({ ok: true, token, lastFour });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing token id." }, { status: 400 });

  // RLS scopes this to the user's own row; eq(user_id) is belt-and-suspenders.
  const { error } = await supabase
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't revoke that token." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
