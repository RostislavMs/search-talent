import { describe, expect, it } from "vitest";
import {
  reactionBulkQuerySchema,
  reactionPayloadSchema,
} from "@/lib/validation/reactions";
import { REACTION_EMOJIS } from "@/lib/constants/reactions";

const uuid = "9c8b6f3a-4f2a-4f9b-89f1-1234567890ab";

describe("reactionPayloadSchema", () => {
  it("accepts a valid project comment reaction", () => {
    const parsed = reactionPayloadSchema.safeParse({
      target_type: "project_comment",
      target_id: uuid,
      emoji: REACTION_EMOJIS[0],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a valid article reaction", () => {
    const parsed = reactionPayloadSchema.safeParse({
      target_type: "article",
      target_id: uuid,
      emoji: REACTION_EMOJIS[2],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an emoji outside the canonical set", () => {
    const parsed = reactionPayloadSchema.safeParse({
      target_type: "article",
      target_id: uuid,
      emoji: "🥑",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown target type", () => {
    const parsed = reactionPayloadSchema.safeParse({
      target_type: "profile",
      target_id: uuid,
      emoji: REACTION_EMOJIS[0],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an invalid target_id", () => {
    const parsed = reactionPayloadSchema.safeParse({
      target_type: "article",
      target_id: "not-a-uuid",
      emoji: REACTION_EMOJIS[0],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("reactionBulkQuerySchema", () => {
  it("accepts a list of valid uuids", () => {
    const parsed = reactionBulkQuerySchema.safeParse({
      target_type: "article_comment",
      target_ids: [uuid, uuid],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an empty list of ids", () => {
    const parsed = reactionBulkQuerySchema.safeParse({
      target_type: "article_comment",
      target_ids: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects more than 200 ids", () => {
    const parsed = reactionBulkQuerySchema.safeParse({
      target_type: "article_comment",
      target_ids: Array.from({ length: 201 }, () => uuid),
    });
    expect(parsed.success).toBe(false);
  });
});
