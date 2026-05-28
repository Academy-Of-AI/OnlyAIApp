import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED = ["/dashboard", "/new-project"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  try {
    const { response, user } = await updateSession(request);

    if (PROTECTED.some((p) => pathname.startsWith(p)) && !user) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return response;
  } catch (err) {
    // If Supabase is temporarily unreachable, don't crash the whole site.
    // Protected routes redirect to sign-in as a safe fallback.
    console.error("[middleware] updateSession failed:", err);

    if (PROTECTED.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
