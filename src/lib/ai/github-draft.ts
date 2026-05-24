import "server-only";

import {
  GITHUB_PROJECT_ROLES,
  type GithubRepoDetail,
} from "@/lib/constants/github";
import { GEMINI_DEFAULT_MODEL } from "@/lib/constants/ai";
import {
  callGeminiJson,
  GeminiType,
  type GeminiJsonResult,
  type GeminiSchema,
} from "@/lib/ai/gemini-client";
import {
  buildGithubDraftPrompt,
  buildGithubDraftSystemInstruction,
  normalizeGithubDraft,
  type GithubDraftFields,
} from "@/lib/ai/github-draft-prompt";

export type GithubDraftResult = GithubDraftFields;

export type GithubDraftRequest = {
  repo: GithubRepoDetail;
  /** Author's GitHub login — lets the model say "you" with confidence. */
  authorLogin: string | null;
  /** UI language. Drives the language of all generated copy. */
  locale: "uk" | "en";
  /**
   * Fields the user already filled. We skip them in the prompt so the
   * model focuses on what's missing. The caller is also expected to
   * skip overwriting them on the client side, but this keeps prompts
   * tighter and cheaper.
   */
  existing: Partial<GithubDraftResult>;
};

/**
 * Response schema for the model. We DON'T use `format: "enum"` here:
 * some Gemini models accept it, others 400 on it, and the role
 * constraint is already enforced server-side via `normalizeGithubDraft`
 * (unknown values fall back to null). Keeping the schema minimal
 * maximises portability across Gemini variants.
 */
const RESPONSE_SCHEMA: GeminiSchema = {
  type: GeminiType.OBJECT,
  properties: {
    role: {
      type: GeminiType.STRING,
      description:
        `Author's role in this repo. One of: ${[...GITHUB_PROJECT_ROLES, "unknown"].join(", ")}. Use "unknown" if the README and metadata don't make it clear.`,
    },
    contribution: {
      type: GeminiType.STRING,
      description:
        "What the author personally built. Concrete, specific. 2-4 sentences.",
    },
    motivation: {
      type: GeminiType.STRING,
      description: "Why this project exists. 1-2 sentences.",
    },
    techDecisions: {
      type: GeminiType.STRING,
      description:
        "Key technical decisions: framework choices, architecture trade-offs, non-obvious calls. 2-4 sentences.",
    },
    learnings: {
      type: GeminiType.STRING,
      description: "What the author learned shipping this. 1-3 sentences.",
    },
    showcaseNotes: {
      type: GeminiType.STRING,
      description:
        "What skills this project demonstrates about the author. 1-2 sentences.",
    },
    productionUsage: {
      type: GeminiType.STRING,
      description:
        "Where this project is used in production if mentioned. Empty string when unknown.",
    },
    projectRole: {
      type: GeminiType.STRING,
      description:
        "A short job-title-style label of the author's role on this project, e.g. 'Lead full-stack engineer' or 'Solo developer'. Different from the GitHub role enum: this is free-form and visible on the project card.",
    },
    problem: {
      type: GeminiType.STRING,
      description:
        "What real-world problem this project addresses. 1-3 short paragraphs.",
    },
    solution: {
      type: GeminiType.STRING,
      description:
        "The author's narrative of HOW the project solves the problem. Cover the approach and the user-facing outcome. Do NOT paste the README verbatim — write in the author's voice. 1-3 short paragraphs.",
    },
    results: {
      type: GeminiType.STRING,
      description:
        "Concrete outcomes: metrics, who benefits, what changed. Empty string if the README and metadata don't support specific claims.",
    },
  },
  required: [
    "role",
    "contribution",
    "motivation",
    "techDecisions",
    "learnings",
    "showcaseNotes",
    "productionUsage",
    "projectRole",
    "problem",
    "solution",
    "results",
  ],
};

export async function generateGithubDraft(
  input: GithubDraftRequest,
): Promise<GeminiJsonResult<GithubDraftResult>> {
  const prompt = buildGithubDraftPrompt(input);
  const systemInstruction = buildGithubDraftSystemInstruction(input.locale);

  // Cyrillic costs ~3× more tokens than ASCII in Gemini's tokenizer,
  // and 2.5 Flash also reserves some budget for hidden "thinking".
  // 6144 leaves headroom for the longest reasonable draft in any
  // locale across all 11 fields.
  const result = await callGeminiJson<{
    role?: string;
    contribution?: string;
    motivation?: string;
    techDecisions?: string;
    learnings?: string;
    showcaseNotes?: string;
    productionUsage?: string;
    projectRole?: string;
    problem?: string;
    solution?: string;
    results?: string;
  }>({
    prompt,
    systemInstruction,
    responseSchema: RESPONSE_SCHEMA,
    model: GEMINI_DEFAULT_MODEL,
    temperature: 0.7,
    maxOutputTokens: 6144,
  });

  return {
    ...result,
    data: normalizeGithubDraft(result.data),
  };
}
