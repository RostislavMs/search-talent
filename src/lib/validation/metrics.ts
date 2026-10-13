import { z } from "zod";
import {
  HOST_MAX,
  MAX_AGE_SECONDS,
  PATH_MAX,
  UTM_MAX,
  type SignupSourcePayload,
} from "@/lib/first-touch";
import { VIEW_TARGET_TYPES } from "@/lib/view-tracking";

// Request bodies of the product-metrics routes. Kept apart from lib/view-tracking
// and lib/first-touch, which also run in the browser and so stay free of zod.

export const viewBeaconSchema = z.object({
  targetType: z.enum(VIEW_TARGET_TYPES),
  targetId: z.string().uuid(),
  referrer: z.string().max(2048).nullish(),
});

export type ViewBeaconPayload = z.infer<typeof viewBeaconSchema>;

export const signupSourceSchema = z.object({
  referrerHost: z.string().max(HOST_MAX).nullable(),
  utmSource: z.string().max(UTM_MAX).nullable(),
  utmMedium: z.string().max(UTM_MAX).nullable(),
  utmCampaign: z.string().max(UTM_MAX).nullable(),
  landingPath: z.string().max(PATH_MAX).nullable(),
  firstSeenAgeSeconds: z.number().int().min(0).max(MAX_AGE_SECONDS),
}) satisfies z.ZodType<SignupSourcePayload>;
