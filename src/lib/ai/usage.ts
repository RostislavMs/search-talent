import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GEMINI_PRICING_USD_PER_M,
  type AiFeature,
  type AiProvider,
} from "@/lib/constants/ai";

type UsageStatus = "ok" | "error" | "rate_limited";

export type LogAiUsageInput = {
  userId: string;
  provider: AiProvider;
  model: string;
  feature: AiFeature;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  status?: UsageStatus;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Returns the dollar cost for a Gemini call. Falls back to 0 for
 * unknown models so we never crash on a new model name; the row still
 * carries token counts.
 */
export function estimateGeminiCostUsd(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number {
  const pricing =
    GEMINI_PRICING_USD_PER_M[
      params.model as keyof typeof GEMINI_PRICING_USD_PER_M
    ];
  if (!pricing) return 0;
  const inputCost = (params.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (params.outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

/**
 * Fire-and-forget logger. Logs are useful but must never bubble up an
 * error that kills the parent request — if the audit table is missing
 * or RLS misbehaves, we still want the AI call to return cleanly.
 */
export async function logAiUsage(
  supabase: SupabaseClient,
  input: LogAiUsageInput,
): Promise<void> {
  const cost = estimateGeminiCostUsd({
    model: input.model,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
  });

  const { error } = await supabase.from("ai_usage").insert({
    user_id: input.userId,
    provider: input.provider,
    model: input.model,
    feature: input.feature,
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    cost_usd: cost,
    duration_ms: input.durationMs ?? null,
    status: input.status ?? "ok",
    error_message: input.errorMessage ?? null,
    metadata: input.metadata ?? null,
  });

  if (error) {
    console.error("[ai-usage] insert failed", error);
  }
}
