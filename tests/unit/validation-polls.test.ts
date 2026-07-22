import { describe, expect, it } from "vitest";
import {
  pollPayloadSchema,
  pollVotePayloadSchema,
  pollCommentPayloadSchema,
  pollTranslationSchema,
  pollModerationPayloadSchema,
  routePollIdSchema,
} from "@/lib/validation/polls";

const uuid = "9c8b6f3a-4f2a-4f9b-89f1-1234567890ab";
const uuid2 = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";

// A single-choice question with the minimum two options.
function choiceQuestion(overrides: Record<string, unknown> = {}) {
  return {
    question_type: "single",
    prompt: "Pick one",
    options: [{ label: "A" }, { label: "B" }],
    ...overrides,
  };
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "My poll",
    category_slug: "general",
    questions: [choiceQuestion()],
    ...overrides,
  };
}

describe("pollPayloadSchema", () => {
  it("accepts a minimal valid payload and applies defaults", () => {
    const result = pollPayloadSchema.safeParse(basePayload());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.content).toBe("");
      expect(result.data.content_locale).toBe("uk");
      expect(result.data.excerpt).toBeNull();
      expect(result.data.closes_at).toBeNull();
      expect(result.data.translations).toEqual({});
      expect(result.data.coAuthorUserIds).toEqual([]);
    }
  });

  it("rejects too-short and too-long titles", () => {
    expect(pollPayloadSchema.safeParse(basePayload({ title: "ab" })).success).toBe(false);
    expect(pollPayloadSchema.safeParse(basePayload({ title: "x".repeat(181) })).success).toBe(
      false,
    );
  });

  it("requires a category slug of at least two chars", () => {
    expect(pollPayloadSchema.safeParse(basePayload({ category_slug: "a" })).success).toBe(false);
  });

  it("requires between one and twenty questions", () => {
    expect(pollPayloadSchema.safeParse(basePayload({ questions: [] })).success).toBe(false);
    const tooMany = Array.from({ length: 21 }, () => choiceQuestion());
    expect(pollPayloadSchema.safeParse(basePayload({ questions: tooMany })).success).toBe(false);
  });

  it("validates closes_at as an ISO datetime", () => {
    expect(
      pollPayloadSchema.safeParse(basePayload({ closes_at: "2026-07-22T10:00:00.000Z" })).success,
    ).toBe(true);
    expect(pollPayloadSchema.safeParse(basePayload({ closes_at: "not-a-date" })).success).toBe(
      false,
    );
  });

  it("rejects an unknown status and content_locale", () => {
    expect(pollPayloadSchema.safeParse(basePayload({ status: "archived" })).success).toBe(false);
    expect(pollPayloadSchema.safeParse(basePayload({ content_locale: "fr" })).success).toBe(false);
  });

  it("dedupes co-author ids and caps at MAX_CO_AUTHORS", () => {
    const result = pollPayloadSchema.safeParse(
      basePayload({ coAuthorUserIds: [uuid, uuid, uuid2] }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.coAuthorUserIds).toEqual([uuid, uuid2]);
    }
  });

  it("rejects more than MAX_CO_AUTHORS distinct co-authors", () => {
    const many = [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ];
    expect(pollPayloadSchema.safeParse(basePayload({ coAuthorUserIds: many })).success).toBe(false);
  });

  it("normalizes a bare cover image host to https", () => {
    const result = pollPayloadSchema.safeParse(basePayload({ cover_image_url: "example.com/a.png" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cover_image_url).toBe("https://example.com/a.png");
    }
  });
});

describe("pollPayloadSchema — question rules (via superRefine)", () => {
  it("requires at least two options for choice questions", () => {
    const oneOption = choiceQuestion({ options: [{ label: "only" }] });
    expect(pollPayloadSchema.safeParse(basePayload({ questions: [oneOption] })).success).toBe(
      false,
    );
  });

  it("accepts a valid rating question with min < max", () => {
    const rating = {
      question_type: "rating",
      prompt: "Rate it",
      options: [],
      rating_min: 1,
      rating_max: 5,
    };
    expect(pollPayloadSchema.safeParse(basePayload({ questions: [rating] })).success).toBe(true);
  });

  it("rejects a rating question missing bounds or with min >= max", () => {
    const base = { question_type: "rating", prompt: "Rate", options: [] };
    expect(
      pollPayloadSchema.safeParse(basePayload({ questions: [{ ...base }] })).success,
    ).toBe(false);
    expect(
      pollPayloadSchema.safeParse(
        basePayload({ questions: [{ ...base, rating_min: 5, rating_max: 5 }] }),
      ).success,
    ).toBe(false);
    expect(
      pollPayloadSchema.safeParse(
        basePayload({ questions: [{ ...base, rating_min: 5, rating_max: 3 }] }),
      ).success,
    ).toBe(false);
  });

  it("rejects a multiple question when multi_min exceeds multi_max", () => {
    const q = choiceQuestion({ question_type: "multiple", multi_min: 3, multi_max: 2 });
    expect(pollPayloadSchema.safeParse(basePayload({ questions: [q] })).success).toBe(false);
  });

  it("rejects a multiple question when multi_max exceeds the option count", () => {
    const q = choiceQuestion({ question_type: "multiple", multi_max: 5 }); // only 2 options
    expect(pollPayloadSchema.safeParse(basePayload({ questions: [q] })).success).toBe(false);
  });

  it("accepts a multiple question with consistent bounds", () => {
    const q = choiceQuestion({
      question_type: "multiple",
      options: [{ label: "A" }, { label: "B" }, { label: "C" }],
      multi_min: 1,
      multi_max: 2,
    });
    expect(pollPayloadSchema.safeParse(basePayload({ questions: [q] })).success).toBe(true);
  });
});

describe("pollVotePayloadSchema", () => {
  it("accepts a well-formed answer set", () => {
    const result = pollVotePayloadSchema.safeParse({
      answers: [{ question_id: uuid, option_ids: [uuid2] }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.answers[0].rating_value).toBeNull();
    }
  });

  it("rejects an empty or over-long answer set", () => {
    expect(pollVotePayloadSchema.safeParse({ answers: [] }).success).toBe(false);
    const tooMany = Array.from({ length: 21 }, () => ({ question_id: uuid }));
    expect(pollVotePayloadSchema.safeParse({ answers: tooMany }).success).toBe(false);
  });

  it("rejects out-of-range rating values", () => {
    expect(
      pollVotePayloadSchema.safeParse({
        answers: [{ question_id: uuid, rating_value: 101 }],
      }).success,
    ).toBe(false);
    expect(
      pollVotePayloadSchema.safeParse({
        answers: [{ question_id: uuid, rating_value: -1 }],
      }).success,
    ).toBe(false);
  });

  it("caps option_ids per answer at 50", () => {
    const ids = Array.from({ length: 51 }, () => uuid);
    expect(
      pollVotePayloadSchema.safeParse({ answers: [{ question_id: uuid, option_ids: ids }] })
        .success,
    ).toBe(false);
  });
});

describe("pollCommentPayloadSchema", () => {
  it("accepts a comment with body only", () => {
    expect(pollCommentPayloadSchema.safeParse({ body: "hi" }).success).toBe(true);
  });

  it("accepts a media-only comment", () => {
    const result = pollCommentPayloadSchema.safeParse({
      body: "",
      media_url: "https://example.com/a.gif",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty comment with neither body nor media", () => {
    expect(pollCommentPayloadSchema.safeParse({ body: "   " }).success).toBe(false);
  });
});

describe("pollTranslationSchema / pollModerationPayloadSchema / routePollIdSchema", () => {
  it("requires a title of at least three chars in a translation", () => {
    expect(pollTranslationSchema.safeParse({ title: "ab" }).success).toBe(false);
    expect(pollTranslationSchema.safeParse({ title: "abc" }).success).toBe(true);
  });

  it("accepts known moderation statuses and rejects others", () => {
    expect(
      pollModerationPayloadSchema.safeParse({ moderation_status: "approved" }).success,
    ).toBe(true);
    expect(pollModerationPayloadSchema.safeParse({ moderation_status: "nope" }).success).toBe(
      false,
    );
  });

  it("validates the route poll id as a uuid", () => {
    expect(routePollIdSchema.safeParse({ id: uuid }).success).toBe(true);
    expect(routePollIdSchema.safeParse({ id: "123" }).success).toBe(false);
  });
});
