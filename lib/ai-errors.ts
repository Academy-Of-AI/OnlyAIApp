/**
 * Turn a raw Anthropic / SDK error into a plain-English message safe to show a
 * non-technical builder. Never leak raw JSON or request ids into the UI.
 */
export function friendlyAiError(err: unknown): string | null {
  const raw = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();

  if (/credit balance is too low|plans & billing|billing|insufficient|quota/.test(raw)) {
    return "The AI service is temporarily unavailable — the account powering it has run low on credit. (Owner: top up at console.anthropic.com → Billing, then try again.)";
  }
  if (/rate limit|overloaded|too many requests|\b429\b|\b529\b/.test(raw)) {
    return "The AI service is busy right now — give it a moment and try again.";
  }
  if (/authentication|invalid x-api-key|api key|unauthorized|\b401\b/.test(raw)) {
    return "AI isn't configured correctly — check the ANTHROPIC_API_KEY in your Vercel settings.";
  }
  if (/max_tokens|too large|context|token/.test(raw)) {
    return "That came back too large to finish — try again, or describe a slightly simpler version.";
  }
  return null; // no known pattern — caller keeps its own (already-friendly) message
}
