import { z } from "zod";

const uuidMessage = "Invalid identifier";
const locale = z.enum(["uk", "en"]).optional();

/**
 * Following a search: the /jobs filters as the address carries them, or
 * "vacancies that fit me". The filters are read again on the server
 * (readJobAlertFilters), so anything unknown is dropped there.
 */
export const createJobAlertSchema = z.union([
  z
    .object({
      match: z.literal("profile"),
      notifyEmail: z.boolean().optional(),
      locale,
    })
    .strict(),
  z
    .object({
      filters: z
        .record(z.string().max(20), z.string().max(100))
        .refine((value) => Object.keys(value).length <= 12, { message: "Too many filters" }),
      notifyEmail: z.boolean().optional(),
      locale,
    })
    .strict(),
]);

export type CreateJobAlertPayload = z.infer<typeof createJobAlertSchema>;

export const updateJobAlertSchema = z.object({ notifyEmail: z.boolean() }).strict();

export const routeJobAlertIdSchema = z.object({
  id: z.string().uuid(uuidMessage),
});

export const jobAlertUnsubscribeSchema = z.object({
  u: z.string().uuid(uuidMessage),
  t: z.string().regex(/^[0-9a-f]{64}$/),
});
