import type { PollPayload } from "@/lib/validation/polls";
import type { PollLocalizedFields } from "@/lib/db/polls";

type SavePollOverrides = {
  id: string | null;
  slug: string;
  categoryId: number;
  /** Already sanitized primary-language body HTML. */
  content: string;
  /** Already sanitized secondary-language versions keyed by locale. */
  translations: Record<string, PollLocalizedFields>;
};

/**
 * Shapes a validated poll payload into the jsonb the `save_poll` RPC consumes.
 * Content is sanitized by the caller before it lands here — never trust the
 * raw body. Questions/options are passed through verbatim; the RPC + DB
 * constraints are the final validators.
 */
export function buildSavePollPayload(payload: PollPayload, overrides: SavePollOverrides) {
  return {
    id: overrides.id,
    category_id: overrides.categoryId,
    title: payload.title,
    slug: overrides.slug,
    excerpt: payload.excerpt,
    content: overrides.content,
    cover_image_url: payload.cover_image_url,
    cover_image_storage_path: payload.cover_image_storage_path,
    status: payload.status,
    content_locale: payload.content_locale,
    translations: overrides.translations,
    closes_at: payload.closes_at,
    questions: payload.questions.map((question) => ({
      question_type: question.question_type,
      prompt: question.prompt,
      prompt_uk: question.prompt_uk,
      rating_min: question.rating_min,
      rating_max: question.rating_max,
      multi_min: question.multi_min,
      multi_max: question.multi_max,
      options: question.options.map((option) => ({
        label: option.label,
        label_uk: option.label_uk,
      })),
    })),
  };
}
