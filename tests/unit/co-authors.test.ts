import { describe, expect, it } from "vitest";
import {
  MAX_CO_AUTHORS,
  MAX_AUTHORS_TOTAL,
  formatAuthorNames,
  sanitizeCoAuthorIds,
  type ContentAuthor,
} from "@/lib/co-authors";
import { articlePayloadSchema } from "@/lib/validation/articles";

const CREATOR = "00000000-0000-4000-8000-000000000000";

function author(partial: Partial<ContentAuthor>): ContentAuthor {
  return {
    userId: partial.userId ?? "x",
    username: partial.username ?? null,
    name: partial.name ?? null,
    avatarUrl: null,
    isOwner: partial.isOwner ?? false,
  };
}

describe("sanitizeCoAuthorIds", () => {
  it("returns [] for non-array input", () => {
    expect(sanitizeCoAuthorIds(undefined, CREATOR)).toEqual([]);
    expect(sanitizeCoAuthorIds("nope", CREATOR)).toEqual([]);
    expect(sanitizeCoAuthorIds(null, CREATOR)).toEqual([]);
  });

  it("drops the creator's own id (no self-co-authoring)", () => {
    expect(sanitizeCoAuthorIds([CREATOR, "a"], CREATOR)).toEqual(["a"]);
  });

  it("dedupes repeated ids", () => {
    expect(sanitizeCoAuthorIds(["a", "a", "b", "a"], CREATOR)).toEqual([
      "a",
      "b",
    ]);
  });

  it("drops empty / whitespace / non-string entries and trims", () => {
    expect(
      sanitizeCoAuthorIds(["  ", "", 42, null, "  c  "], CREATOR),
    ).toEqual(["c"]);
  });

  it("caps the list at MAX_CO_AUTHORS", () => {
    const many = Array.from({ length: MAX_CO_AUTHORS + 3 }, (_, i) => `u${i}`);
    const result = sanitizeCoAuthorIds(many, CREATOR);
    expect(result).toHaveLength(MAX_CO_AUTHORS);
    expect(result).toEqual(many.slice(0, MAX_CO_AUTHORS));
  });

  it("MAX_AUTHORS_TOTAL accounts for the creator", () => {
    expect(MAX_AUTHORS_TOTAL).toBe(MAX_CO_AUTHORS + 1);
  });
});

describe("formatAuthorNames", () => {
  it("returns the fallback for an empty list", () => {
    expect(formatAuthorNames([], { fallback: "SearchTalent" })).toBe(
      "SearchTalent",
    );
  });

  it("joins names up to maxVisible without a suffix", () => {
    const authors = [author({ name: "Alice" }), author({ name: "Bob" })];
    expect(formatAuthorNames(authors, { maxVisible: 2 })).toBe("Alice, Bob");
  });

  it("collapses the overflow into 'та ще N' for uk", () => {
    const authors = [
      author({ name: "Alice" }),
      author({ name: "Bob" }),
      author({ name: "Carol" }),
      author({ name: "Dave" }),
    ];
    expect(formatAuthorNames(authors, { maxVisible: 2, locale: "uk" })).toBe(
      "Alice, Bob та ще 2",
    );
  });

  it("collapses the overflow into '+N' for en", () => {
    const authors = [
      author({ name: "Alice" }),
      author({ name: "Bob" }),
      author({ name: "Carol" }),
    ];
    expect(formatAuthorNames(authors, { maxVisible: 2, locale: "en" })).toBe(
      "Alice, Bob +1",
    );
  });

  it("falls back name -> username -> fallback", () => {
    const authors = [
      author({ name: null, username: "neo" }),
      author({ name: null, username: null }),
    ];
    expect(
      formatAuthorNames(authors, { maxVisible: 2, fallback: "Author" }),
    ).toBe("neo, Author");
  });
});

describe("articlePayloadSchema coAuthorUserIds", () => {
  const baseArticle = {
    title: "A valid article title",
    excerpt: "A short excerpt",
    content: "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do",
    category_slug: "engineering",
  };
  const uuidA = "11111111-1111-4111-8111-111111111111";
  const uuidB = "22222222-2222-4222-8222-222222222222";

  it("defaults to an empty array when omitted", () => {
    const result = articlePayloadSchema.safeParse(baseArticle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.coAuthorUserIds).toEqual([]);
    }
  });

  it("dedupes co-author ids", () => {
    const result = articlePayloadSchema.safeParse({
      ...baseArticle,
      coAuthorUserIds: [uuidA, uuidA, uuidB],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.coAuthorUserIds).toEqual([uuidA, uuidB]);
    }
  });

  it("rejects non-uuid co-author ids", () => {
    expect(
      articlePayloadSchema.safeParse({
        ...baseArticle,
        coAuthorUserIds: ["not-a-uuid"],
      }).success,
    ).toBe(false);
  });

  it("rejects more than MAX_CO_AUTHORS ids", () => {
    // Distinct, well-formed uuids so the failure is the cap, not the format.
    const hex = (n: number) => (n % 16).toString(16);
    const mkUuid = (n: number) =>
      `${hex(n).repeat(8)}-${hex(n).repeat(4)}-4${hex(n).repeat(3)}-8${hex(n).repeat(3)}-${hex(n).repeat(12)}`;
    const tooMany = Array.from({ length: MAX_CO_AUTHORS + 1 }, (_, i) =>
      mkUuid(i + 1),
    );
    expect(new Set(tooMany).size).toBe(MAX_CO_AUTHORS + 1);
    expect(
      articlePayloadSchema.safeParse({
        ...baseArticle,
        coAuthorUserIds: tooMany,
      }).success,
    ).toBe(false);
  });
});
