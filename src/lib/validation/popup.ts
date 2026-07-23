import { z } from "zod";

export const popupKindSchema = z.enum(["message", "feedback"]);

// CTA links must be a same-site relative path or an explicit http(s) URL.
// This blocks `javascript:` and other unsafe schemes from reaching the
// rendered anchor href.
const ctaHrefSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      value === "" || value.startsWith("/") || /^https?:\/\//i.test(value),
    "Link must be a relative path (starting with /) or an http(s) URL",
  );

// Field schemas shared by the create/update variants. Kept default-free here
// so the update schema can stay truly partial (see below).
const titleField = z.string().trim().max(200);
const bodyField = z.string().trim().max(2000);
const ctaLabelField = z.string().trim().max(80);
const delayField = z.number().int().min(0).max(600);

export const popupCreateSchema = z.object({
  kind: popupKindSchema,
  isActive: z.boolean().optional().default(false),
  titleEn: titleField.optional().default(""),
  titleUk: titleField.optional().default(""),
  bodyEn: bodyField.optional().default(""),
  bodyUk: bodyField.optional().default(""),
  ctaLabelEn: ctaLabelField.optional().default(""),
  ctaLabelUk: ctaLabelField.optional().default(""),
  ctaHref: ctaHrefSchema.optional().default(""),
  delaySeconds: delayField.optional().default(5),
});

// Update is genuinely partial: absent fields must parse to `undefined` (NOT the
// create defaults), otherwise a partial PATCH — e.g. toggling `isActive` — would
// blank every unsent column via popupInputToRow. `.strict()` rejects unknown keys.
export const popupUpdateSchema = z
  .object({
    kind: popupKindSchema.optional(),
    isActive: z.boolean().optional(),
    titleEn: titleField.optional(),
    titleUk: titleField.optional(),
    bodyEn: bodyField.optional(),
    bodyUk: bodyField.optional(),
    ctaLabelEn: ctaLabelField.optional(),
    ctaLabelUk: ctaLabelField.optional(),
    ctaHref: ctaHrefSchema.optional(),
    delaySeconds: delayField.optional(),
  })
  .strict();

export type PopupCreateInput = z.infer<typeof popupCreateSchema>;
export type PopupUpdateInput = z.infer<typeof popupUpdateSchema>;

/**
 * True when a message popup has no visible content (no title, body, or button
 * label in either locale) — such a popup would render nothing, so it must not
 * be activated.
 */
export function isEmptyMessageContent(fields: {
  titleEn?: string | null;
  titleUk?: string | null;
  bodyEn?: string | null;
  bodyUk?: string | null;
  ctaLabelEn?: string | null;
  ctaLabelUk?: string | null;
}) {
  return ![
    fields.titleEn,
    fields.titleUk,
    fields.bodyEn,
    fields.bodyUk,
    fields.ctaLabelEn,
    fields.ctaLabelUk,
  ].some((value) => (value ?? "").trim().length > 0);
}

const EMPTY_MESSAGE_ERROR =
  "Add a title, text, or button so the announcement has something to show.";

export { EMPTY_MESSAGE_ERROR };

/** Maps a validated camelCase payload to snake_case table columns. */
export function popupInputToRow(
  input: Partial<PopupCreateInput>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (input.kind !== undefined) row.kind = input.kind;
  if (input.isActive !== undefined) row.is_active = input.isActive;
  if (input.titleEn !== undefined) row.title_en = input.titleEn || null;
  if (input.titleUk !== undefined) row.title_uk = input.titleUk || null;
  if (input.bodyEn !== undefined) row.body_en = input.bodyEn || null;
  if (input.bodyUk !== undefined) row.body_uk = input.bodyUk || null;
  if (input.ctaLabelEn !== undefined)
    row.cta_label_en = input.ctaLabelEn || null;
  if (input.ctaLabelUk !== undefined)
    row.cta_label_uk = input.ctaLabelUk || null;
  if (input.ctaHref !== undefined) row.cta_href = input.ctaHref || null;
  if (input.delaySeconds !== undefined) row.delay_seconds = input.delaySeconds;

  return row;
}
