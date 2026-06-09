import { redirect } from "next/navigation";

// Only forward same-origin, local-path redirects (defense against open redirect).
function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

// Sign-up and sign-in are the same flow (GitHub OAuth creates or logs in).
// Preserve a validated ?next= so intents like /join/[code] survive the bounce.
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
}
