/**
 * Returns the cookie `domain` to use for the auth session so it spans the whole
 * custom domain (apex + www) instead of a single host. Without this, logging in
 * on onlyaiapp.com and then visiting www.onlyaiapp.com (or vice-versa) forces a
 * re-login because cookies are host-only.
 *
 * Returns undefined on *.vercel.app and localhost so per-build previews and
 * local dev are unaffected (they stay host-only).
 *
 * Pure / dependency-free on purpose: it's imported by middleware (Edge runtime),
 * which cannot import `next/headers`.
 */
export function cookieDomainFor(host: string | null): string | undefined {
  if (host && host.replace(/:\d+$/, "").endsWith("onlyaiapp.com")) return ".onlyaiapp.com";
  return undefined;
}
