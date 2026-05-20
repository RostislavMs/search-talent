import { describe, expect, it } from "vitest";
import {
  formatArticleDate,
  getArticleReadingTime,
  getCategoryDisplayName,
  normalizeArticleSort,
  normalizeArticleStatus,
  slugifyArticleTitle,
  sortArticleCategories,
  type ArticleCategory,
} from "@/lib/articles";

const category = (overrides: Partial<ArticleCategory>): ArticleCategory => ({
  id: 1,
  slug: "x",
  name: "Default",
  nameUk: null,
  description: null,
  adminOnly: false,
  ...overrides,
});

describe("normalizeArticleStatus", () => {
  it("returns the value when valid", () => {
    expect(normalizeArticleStatus("draft")).toBe("draft");
    expect(normalizeArticleStatus("published")).toBe("published");
  });

  it("defaults to draft for unknown/empty values", () => {
    expect(normalizeArticleStatus("archived")).toBe("draft");
    expect(normalizeArticleStatus(null)).toBe("draft");
    expect(normalizeArticleStatus(undefined)).toBe("draft");
  });
});

describe("normalizeArticleSort", () => {
  it("returns the value when valid", () => {
    expect(normalizeArticleSort("popular")).toBe("popular");
    expect(normalizeArticleSort("discussed")).toBe("discussed");
  });

  it("defaults to recent for unknown values", () => {
    expect(normalizeArticleSort("nope")).toBe("recent");
    expect(normalizeArticleSort(null)).toBe("recent");
  });
});

describe("slugifyArticleTitle", () => {
  it("creates a kebab-cased slug from plain text", () => {
    expect(slugifyArticleTitle("Hello World Article")).toBe(
      "hello-world-article",
    );
  });

  it("collapses repeated separators and trims dashes", () => {
    expect(slugifyArticleTitle("  Hello   --  World!  ")).toBe("hello-world");
  });

  it("strips non-ASCII characters", () => {
    expect(slugifyArticleTitle("Привіт World")).toBe("world");
  });

  it("returns 'article' when title is empty after sanitation", () => {
    expect(slugifyArticleTitle("🚀🚀🚀")).toBe("article");
    expect(slugifyArticleTitle("   ")).toBe("article");
  });
});

describe("getArticleReadingTime", () => {
  it("returns at least 1 minute for short content", () => {
    expect(getArticleReadingTime("hello world", "en")).toBe("1 min read");
    expect(getArticleReadingTime("", "en")).toBe("1 min read");
  });

  it("scales by ~180 words per minute", () => {
    const longContent = Array.from({ length: 720 }, () => "word").join(" ");
    expect(getArticleReadingTime(longContent, "en")).toBe("4 min read");
  });

  it("localizes the suffix for uk", () => {
    expect(getArticleReadingTime("hi", "uk")).toBe("1 хв читання");
  });
});

describe("getCategoryDisplayName", () => {
  it("returns Ukrainian name for uk locale when available", () => {
    expect(
      getCategoryDisplayName(category({ name: "Engineering", nameUk: "Інженерія" }), "uk"),
    ).toBe("Інженерія");
  });

  it("falls back to default name for uk when nameUk missing", () => {
    expect(
      getCategoryDisplayName(category({ name: "Engineering", nameUk: null }), "uk"),
    ).toBe("Engineering");
  });

  it("returns default name for en", () => {
    expect(
      getCategoryDisplayName(category({ name: "Engineering", nameUk: "Інженерія" }), "en"),
    ).toBe("Engineering");
  });

  it("returns a localized placeholder for null category", () => {
    expect(getCategoryDisplayName(null, "uk")).toBe("Без категорії");
    expect(getCategoryDisplayName(null, "en")).toBe("No category");
  });
});

describe("sortArticleCategories", () => {
  it("sorts categories alphabetically using locale collation", () => {
    const list = [
      category({ id: 1, name: "Zen" }),
      category({ id: 2, name: "Alpha" }),
      category({ id: 3, name: "Mid" }),
    ];

    const sorted = sortArticleCategories(list, "en").map((item) => item.name);
    expect(sorted).toEqual(["Alpha", "Mid", "Zen"]);
  });

  it("does not mutate the input array", () => {
    const list = [
      category({ id: 1, name: "Zen" }),
      category({ id: 2, name: "Alpha" }),
    ];
    sortArticleCategories(list, "en");
    expect(list.map((item) => item.name)).toEqual(["Zen", "Alpha"]);
  });
});

describe("formatArticleDate", () => {
  it("returns a localized placeholder for null", () => {
    expect(formatArticleDate(null, "uk")).toBe("Без дати");
    expect(formatArticleDate(null, "en")).toBe("No date");
  });

  it("returns the raw value when not parseable as a date", () => {
    expect(formatArticleDate("not-a-date", "en")).toBe("not-a-date");
  });

  it("formats valid ISO dates", () => {
    const formatted = formatArticleDate("2024-05-10T00:00:00Z", "en");
    expect(formatted).toMatch(/2024/);
    expect(formatted).toMatch(/May/);
  });
});
