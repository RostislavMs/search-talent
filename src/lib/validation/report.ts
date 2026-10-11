import { z } from "zod";
import {
  moderationStatuses,
  moderationTargetTypes,
  reportReasons,
  reportStatuses,
  reportTargetTypes,
} from "@/lib/moderation";

const uuidMessage = "Invalid identifier";

export const reportPayloadSchema = z.object({
  targetType: z.enum(reportTargetTypes),
  targetId: z.string().uuid(uuidMessage),
  reason: z.enum(reportReasons),
  details: z.string().trim().max(1200).optional().default(""),
});

export const moderationUpdateSchema = z.object({
  targetType: z.enum(moderationTargetTypes),
  targetId: z.string().uuid(uuidMessage),
  moderationStatus: z.enum(moderationStatuses),
  reportId: z.string().uuid(uuidMessage).optional(),
  reportStatus: z.enum(reportStatuses).optional(),
  resolutionNote: z.string().trim().max(1200).optional().default(""),
});
