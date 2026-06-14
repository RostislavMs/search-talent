import { z } from "zod";
import { articleStatuses } from "@/lib/articles";
import { moderationStatuses } from "@/lib/moderation";
import { MAX_CO_AUTHORS } from "@/lib/co-authors";

const optionalUrl = z
  .string()
  .trim()
  .max(2000, "URL is too long")
  .transform((value) => value || null)
  .refine(
    (value) => {
      if (!value) {
        return true;
      }

      const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;

      try {
        const url = new URL(candidate);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Invalid URL" },
  )
  .transform((value) => {
    if (!value) {
      return null;
    }

    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  });

const articleLocales = ["uk", "en"] as const;

// A complete secondary-language version. Only sent when the author actually
// filled the other language, so both title and content are required here.
export const articleTranslationSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(180, "Title is too long"),
  excerpt: z.string().trim().max(420, "Excerpt is too long").nullable().default(null),
  content: z.string().trim().min(20, "Content is too short").max(50000, "Content is too long"),
  cover_image_url: optionalUrl.nullable().default(null),
  cover_image_storage_path: z.string().trim().max(500).nullable().default(null),
  hero_video_url: optionalUrl.nullable().default(null),
  hero_video_storage_path: z.string().trim().max(500).nullable().default(null),
});

export const articlePayloadSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3, "Title is too short").max(180, "Title is too long"),
  excerpt: z.string().trim().max(420, "Excerpt is too long").nullable(),
  content: z.string().trim().min(20, "Content is too short").max(50000, "Content is too long"),
  category_slug: z.string().trim().min(2, "Category is required").max(80),
  status: z.enum(articleStatuses).default("draft"),
  cover_image_url: optionalUrl.nullable().default(null),
  cover_image_storage_path: z.string().trim().max(500).nullable().default(null),
  hero_video_url: optionalUrl.nullable().default(null),
  hero_video_storage_path: z.string().trim().max(500).nullable().default(null),
  // Locale of the primary (top-level) version above.
  content_locale: z.enum(articleLocales).default("uk"),
  // Optional secondary-language versions keyed by locale. A string key (rather
  // than an enum key) keeps this partial — sending zero or one translation is
  // valid; unknown keys are ignored downstream.
  translations: z
    .record(z.string(), articleTranslationSchema)
    .default({}),
  coAuthorUserIds: z
    .array(z.string().uuid())
    .max(MAX_CO_AUTHORS, "Too many co-authors")
    .default([])
    .transform((values) => [...new Set(values)]),
});

export const articleCommentPayloadSchema = z.object({
  body: z.string().trim().min(1, "Comment is required").max(4000, "Comment is too long"),
  parent_id: z.string().uuid().nullable().default(null),
});

export const routeArticleIdSchema = z.object({
  id: z.string().uuid("Invalid article id"),
});

export const articleModerationPayloadSchema = z.object({
  moderation_status: z.enum(moderationStatuses),
  moderation_note: z.string().trim().max(1200, "Note is too long").nullable().default(null),
});
