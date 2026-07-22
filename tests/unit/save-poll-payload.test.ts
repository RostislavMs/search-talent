import { describe, expect, it } from "vitest";
import { buildSavePollPayload } from "@/lib/db/save-poll-payload";
import type { PollPayload } from "@/lib/validation/polls";

function payload(overrides: Partial<PollPayload> = {}): PollPayload {
  return {
    title: "My poll",
    excerpt: null,
    content: "raw <b>body</b>",
    category_slug: "general",
    status: "published",
    cover_image_url: "https://cdn.example.com/c.png",
    cover_image_storage_path: "polls/c.png",
    closes_at: "2026-08-01T00:00:00.000Z",
    content_locale: "uk",
    translations: {},
    questions: [
      {
        question_type: "single",
        prompt: "Pick",
        prompt_uk: "Обери",
        options: [
          { label: "A", label_uk: "А" },
          { label: "B", label_uk: "Б" },
        ],
        rating_min: null,
        rating_max: null,
        multi_min: null,
        multi_max: null,
      },
    ],
    coAuthorUserIds: [],
    ...overrides,
  } as PollPayload;
}

const overrides = {
  id: "poll-1",
  slug: "my-poll",
  categoryId: 7,
  content: "<b>sanitized</b>",
  translations: {},
};

describe("buildSavePollPayload", () => {
  it("uses override id/slug/categoryId/content, not the raw payload", () => {
    const result = buildSavePollPayload(payload(), overrides);
    expect(result.id).toBe("poll-1");
    expect(result.slug).toBe("my-poll");
    expect(result.category_id).toBe(7);
    // The sanitized content from overrides wins over payload.content.
    expect(result.content).toBe("<b>sanitized</b>");
  });

  it("passes through the payload's own scalar fields", () => {
    const result = buildSavePollPayload(payload({ excerpt: "short" }), overrides);
    expect(result.title).toBe("My poll");
    expect(result.excerpt).toBe("short");
    expect(result.status).toBe("published");
    expect(result.content_locale).toBe("uk");
    expect(result.closes_at).toBe("2026-08-01T00:00:00.000Z");
    expect(result.cover_image_url).toBe("https://cdn.example.com/c.png");
    expect(result.cover_image_storage_path).toBe("polls/c.png");
  });

  it("maps questions and options to the RPC shape verbatim", () => {
    const result = buildSavePollPayload(payload(), overrides);
    expect(result.questions).toEqual([
      {
        question_type: "single",
        prompt: "Pick",
        prompt_uk: "Обери",
        rating_min: null,
        rating_max: null,
        multi_min: null,
        multi_max: null,
        options: [
          { label: "A", label_uk: "А" },
          { label: "B", label_uk: "Б" },
        ],
      },
    ]);
  });

  it("does not leak extra option/question keys into the payload", () => {
    const withExtra = payload();
    // Simulate a question carrying a stray field the RPC must not receive.
    (withExtra.questions[0] as Record<string, unknown>).id = "should-be-dropped";
    const result = buildSavePollPayload(withExtra, overrides);
    expect(result.questions[0]).not.toHaveProperty("id");
  });

  it("preserves the overrides translations map", () => {
    const translations = {
      en: {
        title: "My poll",
        excerpt: null,
        content: "<b>en</b>",
        cover_image_url: null,
        cover_image_storage_path: null,
      },
    };
    const result = buildSavePollPayload(payload(), { ...overrides, translations });
    expect(result.translations).toBe(translations);
  });
});
