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
