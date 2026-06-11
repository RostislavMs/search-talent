import type { PollLocalizedFields, PollTranslationInput } from "@/lib/db/polls";
import { sanitizeRichTextHtml } from "@/lib/rich-text";

// Keep write-time sanitization out of the read-only poll bundle. Importing
// DOMPurify there also loads jsdom in Vercel server functions.
export function buildSanitizedPollTranslations(
  translations: Partial<Record<string, PollTranslationInput>> | undefined,
  primaryLocale: string,
): Record<string, PollLocalizedFields> {
  const result: Record<string, PollLocalizedFields> = {};

  for (const [locale, version] of Object.entries(translations ?? {})) {
    if (!version || locale === primaryLocale) {
      continue;
    }

    result[locale] = {
      title: version.title,
      excerpt: version.excerpt ?? null,
      content: sanitizeRichTextHtml(version.content ?? ""),
      cover_image_url: version.cover_image_url ?? null,
      cover_image_storage_path: version.cover_image_storage_path ?? null,
    };
  }

  return result;
}
