import type { SupabaseClient } from "@supabase/supabase-js";

// claude-opus-4-5 approximate pricing (USD per 1M tokens)
const INPUT_PER_M = 15;
const OUTPUT_PER_M = 75;

export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const usd = (inputTokens / 1_000_000) * INPUT_PER_M + (outputTokens / 1_000_000) * OUTPUT_PER_M;
  return Math.round(usd * 100);
}

/** Log an AI usage event with estimated cost. Best-effort. */
export async function logUsage(
  db: SupabaseClient,
  e: { userId: string; projectId?: string | null; kind: string; inputTokens?: number; outputTokens?: number },
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
      cost_cents: estimateCostCents(input, output),
    });
  } catch { /* non-fatal */ }
}
