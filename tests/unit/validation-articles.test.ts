import { describe, expect, it } from "vitest";
import {
  articleCommentPayloadSchema,
  articleModerationPayloadSchema,
  articlePayloadSchema,
  routeArticleIdSchema,
} from "@/lib/validation/articles";

const uuid = "9c8b6f3a-4f2a-4f9b-89f1-1234567890ab";

const baseArticle = {
  title: "A valid article title",
  excerpt: "A short excerpt",
  content: "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do",
  category_slug: "engineering",
};

describe("articlePayloadSchema", () => {
  it("accepts a minimal valid article and applies defaults", () => {
    const result = articlePayloadSchema.safeParse(baseArticle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.cover_image_url).toBeNull();
      expect(result.data.hero_video_url).toBeNull();
    }
  });

  it("rejects too short title/content", () => {
    expect(
      articlePayloadSchema.safeParse({ ...baseArticle, title: "ab" }).success,
    ).toBe(false);
    expect(
      articlePayloadSchema.safeParse({ ...baseArticle, content: "too short" })
        .success,
    ).toBe(false);
  });

  it("rejects too long title/excerpt/content", () => {
    expect(
      articlePayloadSchema.safeParse({
        ...baseArticle,
        title: "x".repeat(181),
      }).success,
    ).toBe(false);
    expect(
      articlePayloadSchema.safeParse({
        ...baseArticle,
        excerpt: "x".repeat(421),
      }).success,
    ).toBe(false);
    expect(
      articlePayloadSchema.safeParse({
        ...baseArticle,
        content: "x".repeat(50_001),
      }).success,
    ).toBe(false);
  });

  it("normalizes cover_image_url without protocol to https://", () => {
    const result = articlePayloadSchema.safeParse({
      ...baseArticle,
      cover_image_url: "example.com/img.png",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cover_image_url).toBe("https://example.com/img.png");
    }
  });

  it("treats empty cover_image_url as null", () => {
    const result = articlePayloadSchema.safeParse({
      ...baseArticle,
      cover_image_url: "   ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cover_image_url).toBeNull();
    }
  });

  it("rejects invalid URLs", () => {
    const result = articlePayloadSchema.safeParse({
      ...baseArticle,
      cover_image_url: "not a url with spaces://broken",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown status values", () => {
    const result = articlePayloadSchema.safeParse({
      ...baseArticle,
      status: "archived",
    });
    expect(result.success).toBe(false);
  });
});

describe("articleCommentPayloadSchema", () => {
  it("requires non-empty body", () => {
    expect(articleCommentPayloadSchema.safeParse({ body: "" }).success).toBe(false);
    expect(articleCommentPayloadSchema.safeParse({ body: "   " }).success).toBe(
      false,
    );
  });

  it("accepts a valid comment with default null parent", () => {
    const result = articleCommentPayloadSchema.safeParse({ body: "Nice piece" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parent_id).toBeNull();
    }
  });

  it("rejects invalid parent_id UUID", () => {
    expect(
      articleCommentPayloadSchema.safeParse({ body: "hi", parent_id: "abc" })
        .success,
    ).toBe(false);
  });

  it("accepts a valid parent_id UUID", () => {
    expect(
      articleCommentPayloadSchema.safeParse({ body: "hi", parent_id: uuid })
        .success,
    ).toBe(true);
  });

  it("rejects bodies above 4000 chars", () => {
    expect(
      articleCommentPayloadSchema.safeParse({ body: "x".repeat(4001) }).success,
    ).toBe(false);
  });
});

describe("routeArticleIdSchema", () => {
  it("accepts valid UUID id", () => {
    expect(routeArticleIdSchema.safeParse({ id: uuid }).success).toBe(true);
  });

  it("rejects invalid id", () => {
    expect(routeArticleIdSchema.safeParse({ id: "nope" }).success).toBe(false);
  });
});

describe("articleModerationPayloadSchema", () => {
  it("accepts known moderation statuses with optional note", () => {
    expect(
      articleModerationPayloadSchema.safeParse({
        moderation_status: "approved",
      }).success,
    ).toBe(true);

    expect(
      articleModerationPayloadSchema.safeParse({
        moderation_status: "removed",
        moderation_note: "policy violation",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown moderation status", () => {
    expect(
      articleModerationPayloadSchema.safeParse({
        moderation_status: "spammy",
      }).success,
    ).toBe(false);
  });
});
