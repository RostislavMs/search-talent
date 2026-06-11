import type {
  ArticleLocalizedFields,
  ArticleTranslationInput,
} from "@/lib/db/articles";
import { sanitizeRichTextHtml } from "@/lib/rich-text";

// Keep write-time sanitization out of the read-only article bundle. Importing
// DOMPurify there also loads jsdom in Vercel server functions.
export function buildSanitizedTranslations(
  translations: Partial<Record<string, ArticleTranslationInput>> | undefined,
  primaryLocale: string,
): Record<string, ArticleLocalizedFields> {
  const result: Record<string, ArticleLocalizedFields> = {};

  for (const [locale, version] of Object.entries(translations ?? {})) {
    if (!version || locale === primaryLocale) {
      continue;
    }

    result[locale] = {
      title: version.title,
      excerpt: version.excerpt ?? null,
      content: sanitizeRichTextHtml(version.content),
      cover_image_url: version.cover_image_url ?? null,
      cover_image_storage_path: version.cover_image_storage_path ?? null,
      hero_video_url: version.hero_video_url ?? null,
      hero_video_storage_path: version.hero_video_storage_path ?? null,
    };
  }

  return result;
}
