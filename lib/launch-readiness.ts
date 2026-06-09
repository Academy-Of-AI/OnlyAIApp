/**
 * Launch-readiness — the honest "is it ALIVE?" check.
 *
 * Pilot's promise is to push a build to the finish line and then fire a truthful
 * "it's alive — it works." That claim has to be earned, so this is deliberately
 * cheap, deterministic, and mostly LLM-free: we fetch the live URL, sniff the
 * HTML for a real app (not just a login wall), and confirm the core plan items
 * actually shipped. Every check catches its own failure and degrades to a useful
 * hint — we never throw, never leak a raw error, and never block the page.
 *
 * No secrets touched here: it only reads a public URL + the plan the caller passes.
 */

export interface ReadinessCheck {
  /** Short human label, e.g. "Deployed & responding". */
  name: string;
  /** Did this check pass? */
  pass: boolean;
  /** One plain-English nudge shown when it fails (or a reassurance when it passes). */
  hint?: string;
}

export interface LaunchReadiness {
  /** True only when every check passed — the gate for the "it's alive" celebration. */
  ready: boolean;
  checks: ReadinessCheck[];
  /** The single most important thing standing between the builder and launch. */
  blocker: string | null;
}

/** Words that, on their own, signal a page is *just* an auth/sign-in wall. */
const AUTH_KEYWORDS = [
  "sign in", "signin", "sign-in", "log in", "login", "log-in",
  "sign up", "signup", "sign-up", "register", "create account",
  "forgot password", "reset password", "continue with google",
  "continue with github", "authentication required",
];

/** Strip tags/scripts/styles so we score *visible* copy, not framework boilerplate. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Heuristic: is this page MORE than a bare login wall? An app that gates behind
 * auth in v1 reads as "not launched yet" to a visitor. We pass when the visible
 * copy has real substance beyond auth words (a decent word count that isn't
 * dominated by sign-in language).
 */
function looksLikeRealApp(html: string): boolean {
  const text = visibleText(html);
  if (!text) return false;
  const words = text.split(" ").filter(Boolean);
  // Almost no copy at all -> can't tell it's alive (likely a blank/redirect shell).
  if (words.length < 12) return false;

  const authHits = AUTH_KEYWORDS.reduce(
    (n, kw) => (text.includes(kw) ? n + 1 : n),
    0,
  );
  // A short page that's mostly auth words is a login wall. A page with plenty of
  // other content passes even if it also has a "Sign in" link in the corner.
  const looksAuthOnly = authHits >= 2 && words.length < 60;
  return !looksAuthOnly;
}

/** Normalize a possibly-bare URL to an absolute https URL we can fetch. */
function toFetchable(url: string): string {
  const t = url.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/**
 * Run the launch-readiness checklist for one project.
 *
 * @param input.url        the project's live/preview URL (null if not deployed yet)
 * @param input.nowTasks   the plan's "now" (v1) items — what must ship for launch
 * @param input.doneTasks  the items the builder has marked shipped (plan_progress)
 */
export async function checkLaunchReadiness(input: {
  url: string | null;
  nowTasks?: string[];
  doneTasks?: string[];
}): Promise<LaunchReadiness> {
  const { url } = input;
  const nowTasks = (input.nowTasks ?? []).filter((t) => typeof t === "string" && t.trim());
  const doneSet = new Set((input.doneTasks ?? []).filter((t) => typeof t === "string"));

  const checks: ReadinessCheck[] = [];

  // ── 1. Deployed & responding ──────────────────────────────────────────────
  // Fetch the live URL with a short timeout. 2xx = it's up. We attempt a cheap
  // HEAD first, then fall back to GET (some hosts/CDNs don't answer HEAD), and
  // reuse the GET body for check #2 so we only pay one full request.
  let html: string | null = null;
  let responding = false;

  if (!url) {
    checks.push({
      name: "Deployed & responding",
      pass: false,
      hint: "No live URL yet — deploy the app first, then re-check.",
    });
  } else {
    const target = toFetchable(url);
    try {
      // HEAD: cheapest liveness probe.
      const head = await fetch(target, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      responding = head.ok;
      if (!head.ok) {
        // Some servers reject/204 HEAD — confirm with a GET before failing.
        const get = await fetch(target, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        });
        responding = get.ok;
        if (get.ok) html = await get.text().catch(() => null);
      }
      checks.push({
        name: "Deployed & responding",
        pass: responding,
        hint: responding
          ? undefined
          : "The live URL didn't return a healthy response — open it to see the error, then redeploy.",
      });
    } catch {
      checks.push({
        name: "Deployed & responding",
        pass: false,
        hint: "Couldn't reach the live URL (timeout or network error). Check the latest deploy.",
      });
    }
  }

  // ── 2. Not just a login wall ──────────────────────────────────────────────
  // Only meaningful if the site responded. Fetch the HTML (if we don't have it
  // already) and check it's a real app, not a bare sign-in page.
  if (url && responding) {
    try {
      if (html === null) {
        const res = await fetch(toFetchable(url), {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        });
        html = res.ok ? await res.text().catch(() => null) : null;
      }
      if (html === null) {
        checks.push({
          name: "Not just a login wall",
          pass: false,
          hint: "Couldn't read the homepage to confirm there's a real app behind it.",
        });
      } else {
        const real = looksLikeRealApp(html);
        checks.push({
          name: "Not just a login wall",
          pass: real,
          hint: real
            ? undefined
            : "The homepage looks like a bare sign-in screen. Show the working app (with demo data) before the login wall so visitors see the product.",
        });
      }
    } catch {
      checks.push({
        name: "Not just a login wall",
        pass: false,
        hint: "Couldn't read the homepage to confirm there's a real app behind it.",
      });
    }
  } else {
    // Can't evaluate content when the site isn't responding.
    checks.push({
      name: "Not just a login wall",
      pass: false,
      hint: "Get the app responding first, then we can confirm it's more than a login screen.",
    });
  }

  // ── 3. Core features shipped ──────────────────────────────────────────────
  // The plan's "now" items are the v1 must-haves. Pass when every one is marked
  // done. With no plan we can't measure scope, so we don't claim it's shipped.
  if (nowTasks.length === 0) {
    checks.push({
      name: "Core features shipped",
      pass: false,
      hint: "Set a plan of record (the v1 \"now\" list) so we can tell when the core is done.",
    });
  } else {
    const remaining = nowTasks.filter((t) => !doneSet.has(t));
    const shipped = remaining.length === 0;
    checks.push({
      name: "Core features shipped",
      pass: shipped,
      hint: shipped
        ? undefined
        : `${remaining.length} of ${nowTasks.length} v1 feature${remaining.length === 1 ? "" : "s"} left — next up: ${remaining[0]}`,
    });
  }

  // ── Verdict ────────────────────────────────────────────────────────────────
  const ready = checks.every((c) => c.pass);
  // The single most important blocker = the first failing check's hint (checks
  // are ordered most-fundamental first: can't be "alive" if it isn't responding).
  const firstFail = checks.find((c) => !c.pass);
  const blocker = ready ? null : (firstFail?.hint ?? `${firstFail?.name ?? "A check"} isn't passing yet.`);

  return { ready, checks, blocker };
}
