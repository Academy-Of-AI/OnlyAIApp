import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * OAuth / magic-link callback. Exchanges the PKCE code for a session. The server
 * client (lib/supabase/server) reads AND writes cookies through the same
 * next/headers store, so the session both persists to the browser and is
 * readable back during the exchange — Next.js applies those cookie mutations to
 * this redirect response.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
