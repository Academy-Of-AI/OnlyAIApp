/**
 * Deterministic date formatting for SSR-rendered output.
 *
 * `new Date(iso).toLocaleDateString()` with no args uses the RUNTIME's locale +
 * timezone — which differs between the server (UTC) and the browser (the user's
 * locale/TZ), so the server-rendered HTML and the client's first render disagree
 * and React throws a hydration mismatch (#418), which in turn forces a full
 * client re-render (the dashboard "freeze"/jank). Pinning the locale AND timezone
 * makes both sides produce the SAME string. Use this for any date shown in a
 * server-rendered (or hydrated) component.
 */
export function formatDate(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Same hydration-safe contract as formatDate, but including the time (UTC). Use
 * for "Created"/"Deployed"-style metadata rows that want the clock too. Pinned
 * locale + UTC so the server-rendered string matches the client's first render.
 */
export function formatDateTime(iso: string | number | Date): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

/**
 * Deterministic money formatting (pinned locale) — the currency twin of
 * formatDate. A bare `Number.toLocaleString(undefined, {style:'currency'})` uses
 * the runtime locale and so differs server vs client (same hydration class as
 * dates). `cents` is the minor unit; `currency` an ISO code (e.g. "usd").
 */
export function formatMoney(cents: number, currency: string): string {
  try {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
