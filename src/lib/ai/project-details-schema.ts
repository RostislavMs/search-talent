import "server-only";

import { GeminiType, type GeminiSchema } from "@/lib/ai/gemini-client";
import type { DetailDraftField } from "@/lib/ai/project-details-draft";

/** Response-schema properties for the extra draft fields (see project-details-draft). */
export function detailDraftProperties(
  fields: DetailDraftField[],
): Record<string, GeminiSchema> {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      field.list
        ? {
            type: GeminiType.ARRAY,
            items: { type: GeminiType.STRING },
            description: field.description,
          }
        : { type: GeminiType.STRING, description: field.description },
    ]),
  );
}
