import { z } from "zod";
import {
  REACTION_EMOJIS,
  REACTION_TARGET_TYPES,
} from "@/lib/constants/reactions";

export const reactionTargetTypeSchema = z.enum(REACTION_TARGET_TYPES);

export const reactionPayloadSchema = z.object({
  target_type: reactionTargetTypeSchema,
  target_id: z.string().uuid(),
  emoji: z.enum(REACTION_EMOJIS),
});

export const reactionBulkQuerySchema = z.object({
  target_type: reactionTargetTypeSchema,
  target_ids: z.array(z.string().uuid()).min(1).max(200),
});
