/**
 * Post-deploy canary — the difference between "status says deployed" and "the
 * URL actually resolves."
 *
 * Drift #1's tail: Vercel can report READY while the URL we're about to hand the
 * user still 404s — because the alias we resolved was the WRONG one (a bare
 * `<name>.vercel.app` guess for a team account, whose real alias has a
 * `-<scope>` suffix). "READY" and "the link works" are different facts; only the
 * second is the promise. This HEADs/GETs the candidate URL and reports whether
 * it truly answers, so the verifier can settle "deployed" against a link it has
 * actually seen resolve — never an optimistic one.
 *
 * Fail-SAFE, not fail-open: a network error or timeout returns `ok: false`
 * (unknown ≠ live), so an unreachable URL is never promoted to a live link.
 */
export async function urlResolves(
  url: string,
  { timeoutMs = 6000 }: { timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number | null }> {
  const target = url.startsWith("http") ? url : `https://${url}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // GET (not HEAD): some hosts 405 HEAD but answer GET, and a redirect to
    // /login (307/308) still proves the app is live. `ok` = any non-error
    // status (< 400). `redirect: manual` so a 3xx counts as "resolved", not as
    // its target's status.
    const res = await fetch(target, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "OnlyAIApp-Pilot-Canary/1.0" },
    });
    return { ok: res.status > 0 && res.status < 400, status: res.status };
  } catch {
    return { ok: false, status: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Given the candidate production URLs (best-guess alias first, the deployment's
 * own URL as fallback), return the FIRST that actually resolves. Returns null if
 * none answer — in which case the caller must NOT claim "deployed" yet.
 */
export async function firstResolvingUrl(
  candidates: Array<string | null | undefined>,
  opts?: { timeoutMs?: number },
): Promise<string | null> {
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c) continue;
    const url = c.startsWith("http") ? c : `https://${c}`;
    if (seen.has(url)) continue;
    seen.add(url);
    const { ok } = await urlResolves(url, opts);
    if (ok) return url;
  }
  return null;
}
