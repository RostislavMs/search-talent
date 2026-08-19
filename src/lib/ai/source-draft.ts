import "server-only";

import type {
  IntegrationResourceDetail,
  ProviderIntegrationId,
} from "@/lib/constants/provider-integrations";
import { GEMINI_DEFAULT_MODEL } from "@/lib/constants/ai";
import {
  callGeminiJson,
  GeminiType,
  type GeminiJsonResult,
  type GeminiSchema,
} from "@/lib/ai/gemini-client";
import {
  buildSourceDraftPrompt,
  buildSourceDraftSystemInstruction,
  normalizeSourceDraft,
  type SourceDraftFields,
} from "@/lib/ai/source-draft-prompt";

export type SourceDraftResult = SourceDraftFields;

export type SourceDraftRequest = {
  provider: ProviderIntegrationId;
  resource: IntegrationResourceDetail;
  /** The author's handle on the provider — lets the model address them. */
  authorLogin: string | null;
  locale: "uk" | "en";
  /** Fields the author already wrote. Skipped in the prompt and on apply. */
  existing: Partial<SourceDraftResult>;
};

const RESPONSE_SCHEMA: GeminiSchema = {
  type: GeminiType.OBJECT,
  properties: {
    description: {
      type: GeminiType.STRING,
      description:
        "A short blurb for the project card: what this is, in 1-2 sentences. No marketing tone.",
    },
    projectRole: {
      type: GeminiType.STRING,
      description:
        "A short job-title-style label of the author's role on this project, e.g. 'Motion designer' or '3D artist'. Free-form, shown on the project card.",
    },
    problem: {
      type: GeminiType.STRING,
      description:
        "What task or brief this project answered. 1-3 short paragraphs. Empty string if the input doesn't support it.",
    },
    solution: {
      type: GeminiType.STRING,
      description:
        "The author's narrative of HOW they approached and made it — process, tools, decisions. Do NOT paste the source text verbatim; write it in the author's voice. 1-3 short paragraphs.",
    },
    results: {
      type: GeminiType.STRING,
      description:
        "Concrete outcomes: metrics, audience, what changed. Empty string unless the input supports specific claims.",
    },
  },
  required: ["description", "projectRole", "problem", "solution", "results"],
};

/**
 * Drafts the project narrative from an imported provider resource. Same
 * contract as `generateGithubDraft`: every returned field is a suggestion the
 * author can accept, edit or ignore, and the caller only applies it to fields
 * that are still empty.
 */
export async function generateSourceDraft(
  input: SourceDraftRequest,
): Promise<GeminiJsonResult<SourceDraftResult>> {
  const result = await callGeminiJson<{
    description?: string;
    projectRole?: string;
    problem?: string;
    solution?: string;
    results?: string;
  }>({
    prompt: buildSourceDraftPrompt(input),
    systemInstruction: buildSourceDraftSystemInstruction(input.locale),
    responseSchema: RESPONSE_SCHEMA,
    model: GEMINI_DEFAULT_MODEL,
    temperature: 0.7,
    // Five fields instead of GitHub's eleven, but Cyrillic still costs ~3×
    // per character, so keep a comfortable ceiling.
    maxOutputTokens: 4096,
  });

  return {
    ...result,
    data: normalizeSourceDraft(result.data),
  };
}
