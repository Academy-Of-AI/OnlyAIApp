/**
 * Turn a raw Anthropic / SDK error into a plain-English message safe to show a
 * non-technical builder. Never leak raw JSON or request ids into the UI.
 */
export function friendlyAiError(err: unknown): string | null {
  const raw = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  // Monthly usage/spend cap reached on the owner account (Anthropic Console →
  // Settings → Limits). Distinct from a zero balance: access auto-returns next
  // month. Keep the user moving via the no-AI "Skip" path, which still works.
  if (/usage limit|reached your specified|regain access|spend limit|monthly limit/.test(raw)) {
    return "Plan generation is paused — we've hit this month's AI capacity. You can keep going right now: tap 'Skip — use my docs as-is' to commit your spec and hand it straight to your agent (no AI needed). Full generation will be back shortly. (Owner: raise the monthly cap at console.anthropic.com → Settings → Limits.)";
  }
  if (/credit balance is too low|plans & billing|billing|insufficient|quota/.test(raw)) {
    return "The AI service is temporarily unavailable — the account powering it has run low on credit. (Owner: top up at console.anthropic.com → Billing, then try again.)";
  }
  if (/rate limit|overloaded|too many requests|\b429\b|\b529\b/.test(raw)) {
    return "The AI service is busy right now — give it a moment and try again.";
  }
  // ONLY genuine Anthropic auth errors. A bare 401 / "unauthorized" / "api key"
  // is almost always a GitHub or Supabase token problem — those must NOT be
  // blamed on the AI key (that mislabel sent every GitHub-token failure to
  // "check your ANTHROPIC_API_KEY"). Require an Anthropic-shaped signal.
  if (/x-api-key|anthropic|authentication_error/.test(raw)) {
    return "AI isn't configured correctly — check the ANTHROPIC_API_KEY in your Vercel settings.";
  }
  if (/max_tokens|too large|context|token/.test(raw)) {
    return "That came back too large to finish — try again, or describe a slightly simpler version.";
  }
  return null; // no known pattern — caller keeps its own (already-friendly) message
}
