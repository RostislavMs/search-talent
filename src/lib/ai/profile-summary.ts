import "server-only";

import { GEMINI_DEFAULT_MODEL } from "@/lib/constants/ai";
import {
  callGeminiJson,
  GeminiType,
  type GeminiJsonResult,
  type GeminiSchema,
} from "@/lib/ai/gemini-client";
import {
  buildProfileSummaryPrompt,
  buildProfileSummarySystemInstruction,
  normalizeProfileSummary,
  type ProfileSummaryInput,
} from "@/lib/ai/profile-summary-prompt";

const RESPONSE_SCHEMA: GeminiSchema = {
  type: GeminiType.OBJECT,
  properties: {
    summary: {
      type: GeminiType.STRING,
      description:
        "Exactly two sentences. Third person. Concrete and grounded in the input. No hype.",
    },
  },
  required: ["summary"],
};

export type ProfileSummaryResult = {
  summary: string;
};

export async function generateProfileSummary(
  input: ProfileSummaryInput,
): Promise<GeminiJsonResult<ProfileSummaryResult>> {
  const prompt = buildProfileSummaryPrompt(input);
  const systemInstruction = buildProfileSummarySystemInstruction(input.locale);

  const result = await callGeminiJson<{ summary?: string }>({
    prompt,
    systemInstruction,
    responseSchema: RESPONSE_SCHEMA,
    model: GEMINI_DEFAULT_MODEL,
    temperature: 0.6,
    // Two short sentences don't need much — but Gemini 2.5's hidden
    // thinking budget can eat the visible output if we set this too
    // low. We also disable thinking entirely for this task: there is
    // nothing to "reason" about for a 2-sentence blurb.
    maxOutputTokens: 2048,
    disableThinking: true,
  });

  return {
    ...result,
    data: {
      summary: normalizeProfileSummary(result.data.summary),
    },
  };
}
