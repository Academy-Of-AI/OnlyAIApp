import { NextResponse } from "next/server";

/**
 * GET /r/[code] — referral link. Stash the referrer's handle in a cookie,
 * then send them to sign in. Attribution happens on GitHub connect.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const origin = new URL(request.url).origin;
  const res = NextResponse.redirect(`${origin}/sign-in`);
  const handle = (code || "").trim().slice(0, 60);
  if (handle) {
    res.cookies.set("ref", handle, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return res;
}
