import type { SupabaseClient } from "@supabase/supabase-js";

// Approximate pricing (USD per 1M tokens), per model. Unknown model -> Sonnet.
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-5": { in: 15, out: 75 },
  "claude-sonnet-4-5": { in: 3, out: 15 },
  "claude-3-5-haiku-latest": { in: 0.8, out: 4 },
};
function priceFor(model?: string): { in: number; out: number } {
  return (model && PRICING[model]) || { in: 3, out: 15 };
}

export function estimateCostCents(inputTokens: number, outputTokens: number, model?: string): number {
  const p = priceFor(model);
  const usd = (inputTokens / 1_000_000) * p.in + (outputTokens / 1_000_000) * p.out;
  return Math.round(usd * 100);
}

/** Log an AI usage event with estimated cost. Best-effort. */
export async function logUsage(
  db: SupabaseClient,
  e: { userId: string; projectId?: string | null; kind: string; inputTokens?: number; outputTokens?: number; model?: string },
): Promise<void> {
  const input = e.inputTokens ?? 0;
  const output = e.outputTokens ?? 0;
  try {
    await db.from("usage_events").insert({
      user_id: e.userId,
      project_id: e.projectId ?? null,
      kind: e.kind,
      input_tokens: input,
      output_tokens: output,
      cost_cents: estimateCostCents(input, output, e.model),
    });
  } catch { /* non-fatal */ }
}
