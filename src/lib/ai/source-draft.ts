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
import {
  getDetailDraftFields,
  normalizeDetailsDraft,
  type DetailsDraft,
} from "@/lib/ai/project-details-draft";
import { detailDraftProperties } from "@/lib/ai/project-details-schema";
import type { ProjectKind } from "@/lib/projects";

export type SourceDraftResult = SourceDraftFields & Partial<DetailsDraft>;

export type SourceDraftRequest = {
  provider: ProviderIntegrationId;
  resource: IntegrationResourceDetail;
  /** The author's handle on the provider — lets the model address them. */
  authorLogin: string | null;
  locale: "uk" | "en";
  /** Fields the author already wrote. Skipped in the prompt and on apply. */
  existing: Partial<SourceDraftFields>;
  /**
   * The project kind. When given, the draft also fills that kind's details
   * (architecture, language, license…) and the technology tags.
   */
  kind?: ProjectKind | null;
};

const BASE_PROPERTIES: Record<string, GeminiSchema> = {
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
};

function buildResponseSchema(kind: ProjectKind | null | undefined): GeminiSchema {
  const extra = kind === undefined ? [] : getDetailDraftFields(kind);

  return {
    type: GeminiType.OBJECT,
    properties: { ...BASE_PROPERTIES, ...detailDraftProperties(extra) },
    required: [...Object.keys(BASE_PROPERTIES), ...extra.map((field) => field.key)],
  };
}

/**
 * Drafts the project narrative from an imported provider resource. Same
 * contract as `generateGithubDraft`: every returned field is a suggestion the
 * author can accept, edit or ignore, and the caller only applies it to fields
 * that are still empty.
 */
export async function generateSourceDraft(
  input: SourceDraftRequest,
): Promise<GeminiJsonResult<SourceDraftResult>> {
  const result = await callGeminiJson<
    Parameters<typeof normalizeSourceDraft>[0] & Record<string, unknown>
  >({
    prompt: buildSourceDraftPrompt(input),
    systemInstruction: buildSourceDraftSystemInstruction(input.locale),
    responseSchema: buildResponseSchema(input.kind),
    model: GEMINI_DEFAULT_MODEL,
    temperature: 0.7,
    // Five story fields instead of GitHub's twelve, but Cyrillic still costs
    // ~3× per character; the kind details and technology tags add a little.
    maxOutputTokens: 5120,
  });

  const { resource } = input;
  const data: SourceDraftResult = normalizeSourceDraft(result.data);

  if (input.kind !== undefined) {
    const stat = (key: string) =>
      resource.stats.find((entry) => entry.key === key)?.value ?? null;

    Object.assign(
      data,
      normalizeDetailsDraft(input.kind, result.data, {
        languages: (stat("languages") ?? "")
          .split(",")
          .map((language) => language.trim())
          .filter(Boolean),
        license: stat("license"),
        sourceText: [resource.description, resource.url, resource.homepageUrl, resource.longText]
          .filter(Boolean)
          .join("\n"),
      }),
    );
  }

  return { ...result, data };
}
