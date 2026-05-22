import { z } from "zod";

export const markNotificationsReadSchema = z
  .object({
    ids: z.array(z.string().uuid()).max(200).optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.all) || (value.ids && value.ids.length > 0), {
    message: "Provide ids or set all=true",
  });
