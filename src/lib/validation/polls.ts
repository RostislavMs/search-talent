import { z } from "zod";
import { pollStatuses, pollQuestionTypes } from "@/lib/polls";
import { moderationStatuses } from "@/lib/moderation";

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

const pollLocales = ["uk", "en"] as const;

const pollOptionSchema = z.object({
  label: z.string().trim().min(1, "Option text is required").max(200, "Option is too long"),
  label_uk: z.string().trim().max(200).nullable().default(null),
});

const pollQuestionSchema = z
  .object({
    question_type: z.enum(pollQuestionTypes),
    prompt: z.string().trim().min(1, "Question is required").max(300, "Question is too long"),
    prompt_uk: z.string().trim().max(300).nullable().default(null),
    options: z.array(pollOptionSchema).max(30, "Too many options").default([]),
    rating_min: z.number().int().min(0).max(100).nullable().default(null),
    rating_max: z.number().int().min(1).max(100).nullable().default(null),
    multi_min: z.number().int().min(1).max(100).nullable().default(null),
    multi_max: z.number().int().min(1).max(100).nullable().default(null),
  })
  .superRefine((question, ctx) => {
    if (question.question_type === "rating") {
      if (
        question.rating_min === null ||
        question.rating_max === null ||
        question.rating_min >= question.rating_max
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Rating scale is invalid",
          path: ["rating_max"],
        });
      }
      return;
    }

    if (question.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least two options",
        path: ["options"],
      });
    }

    if (question.question_type === "multiple") {
      if (
        question.multi_min !== null &&
        question.multi_max !== null &&
        question.multi_min > question.multi_max
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Min selections cannot exceed max",
          path: ["multi_max"],
        });
      }
      if (question.multi_max !== null && question.multi_max > question.options.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Max selections exceeds the number of options",
          path: ["multi_max"],
        });
      }
    }
  });

// A complete secondary-language version of the poll body. Questions/options
// are single-language in the MVP; only the post body is translated.
export const pollTranslationSchema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(180, "Title is too long"),
  excerpt: z.string().trim().max(420, "Excerpt is too long").nullable().default(null),
  content: z.string().trim().max(50000, "Content is too long").default(""),
  cover_image_url: optionalUrl.nullable().default(null),
  cover_image_storage_path: z.string().trim().max(500).nullable().default(null),
});

export const pollPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3, "Title is too short").max(180, "Title is too long"),
  excerpt: z.string().trim().max(420, "Excerpt is too long").nullable().default(null),
  // The post body is optional for polls — a poll can be just a question.
  content: z.string().trim().max(50000, "Content is too long").default(""),
  category_slug: z.string().trim().min(2, "Category is required").max(80),
  status: z.enum(pollStatuses).default("draft"),
  cover_image_url: optionalUrl.nullable().default(null),
  cover_image_storage_path: z.string().trim().max(500).nullable().default(null),
  closes_at: z.string().datetime({ message: "Invalid date" }).nullable().default(null),
  content_locale: z.enum(pollLocales).default("uk"),
  translations: z.record(z.string(), pollTranslationSchema).default({}),
  questions: z
    .array(pollQuestionSchema)
    .min(1, "Add at least one question")
    .max(20, "Too many questions"),
});

export const pollVotePayloadSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        option_ids: z.array(z.string().uuid()).max(50).default([]),
        rating_value: z.number().int().min(0).max(100).nullable().default(null),
      }),
    )
    .min(1, "No answers provided")
    .max(20),
});

export const pollCommentPayloadSchema = z.object({
  body: z.string().trim().min(1, "Comment is required").max(4000, "Comment is too long"),
  parent_id: z.string().uuid().nullable().default(null),
});

export const routePollIdSchema = z.object({
  id: z.string().uuid("Invalid poll id"),
});

export const pollModerationPayloadSchema = z.object({
  moderation_status: z.enum(moderationStatuses),
  moderation_note: z.string().trim().max(1200, "Note is too long").nullable().default(null),
});

export type PollPayload = z.infer<typeof pollPayloadSchema>;
export type PollQuestionPayload = z.infer<typeof pollQuestionSchema>;
