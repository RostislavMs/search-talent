import "server-only";

import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { GEMINI_DEFAULT_MODEL } from "@/lib/constants/ai";

/**
 * Thin server-side wrapper around `@google/genai`.
 *
 * - Lazy single-instance client (avoids re-instantiating on hot reload).
 * - Tracks duration and token counts for the audit log.
 * - Returns structured JSON via `responseSchema` so callers don't have
 *   to parse free-form text.
 */

let cachedClient: GoogleGenAI | null = null;

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set");
    this.name = "GeminiNotConfiguredError";
  }
}

function getClient(): GoogleGenAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();
  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export type GeminiJsonResult<T> = {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
};

/**
 * Calls Gemini with a strict JSON schema. The model is forced to emit
 * `application/json` matching `responseSchema`, so the SDK already
 * validates the shape on the way out. We `JSON.parse` defensively in
 * case the SDK returns the raw text.
 */
export async function callGeminiJson<T>(params: {
  prompt: string;
  systemInstruction?: string;
  responseSchema: Schema;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /**
   * Disables Gemini 2.5's "thinking" budget. By default 2.5 Flash
   * reserves a portion of `maxOutputTokens` for internal reasoning,
   * which can starve short structured outputs (especially in
   * Cyrillic where every token is expensive). Set true for cheap
   * deterministic JSON outputs.
   */
  disableThinking?: boolean;
}): Promise<GeminiJsonResult<T>> {
  const ai = getClient();
  const model = params.model || GEMINI_DEFAULT_MODEL;
  const started = Date.now();

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: params.prompt }] }],
    config: {
      ...(params.systemInstruction
        ? { systemInstruction: params.systemInstruction }
        : {}),
      ...(params.disableThinking
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : {}),
      responseMimeType: "application/json",
      responseSchema: params.responseSchema,
      temperature: params.temperature ?? 0.6,
      maxOutputTokens: params.maxOutputTokens ?? 4096,
    },
  });

  const text = response.text ?? "";
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    throw new Error(
      `Gemini stopped before finishing the response (reason: ${finishReason}). Try again or shorten the input.`,
    );
  }

  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    // Attempt a partial recovery: if the model emitted valid JSON
    // followed by extra text, slice at the last closing brace.
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace > 0) {
      try {
        parsed = JSON.parse(text.slice(0, lastBrace + 1)) as T;
      } catch {
        throw new Error(
          `Gemini returned non-JSON payload: ${text.slice(0, 200)}`,
        );
      }
    } else {
      throw new Error(
        `Gemini returned non-JSON payload: ${text.slice(0, 200)}`,
      );
    }
  }

  const usage = response.usageMetadata;
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens =
    usage?.candidatesTokenCount ?? usage?.totalTokenCount ?? 0;

  return {
    data: parsed,
    model,
    inputTokens,
    outputTokens,
    durationMs: Date.now() - started,
  };
}

export { Type as GeminiType, type Schema as GeminiSchema };
