import { describe, expect, it } from "vitest";
import {
  AUTO_MODERATION_LINK_LIMIT,
  autoModerationCategories,
  describeModerationResult,
  isAutoModerationNote,
  parseAutoModerationResult,
} from "@/lib/auto-moderation";

// The screening itself (blocklist, look-alike letters, leet, spaced words,
// links, shouting, scam phrases) runs in the database — moderation_screen()
// in database/2026-10-06-moderation-in-db.sql — and its cases are checked
// there. What is left in TypeScript is reading the result and explaining it.

describe("parseAutoModerationResult", () => {
  it("reads the database's result", () => {
    expect(
      parseAutoModerationResult({
        flagged: true,
        categories: ["profanity", "spam"],
        matches: [{ category: "profanity" }, { category: "spam", detail: "links", count: 14 }],
        note: "[авто] Виявлено: …",
      }),
    ).toEqual({
      flagged: true,
      categories: ["profanity", "spam"],
      matches: [{ category: "profanity" }, { category: "spam", detail: "links", count: 14 }],
    });
  });

  it("drops what it does not know", () => {
    expect(
      parseAutoModerationResult({
        categories: ["profanity", "weird"],
        matches: [{ category: "weird" }, null, "x", { category: "spam", detail: "other", count: "3" }],
      }),
    ).toEqual({ flagged: true, categories: ["profanity"], matches: [{ category: "spam" }] });
  });

  it("is null for nothing usable", () => {
    expect(parseAutoModerationResult(null)).toBeNull();
    expect(parseAutoModerationResult("text")).toBeNull();
    expect(parseAutoModerationResult({ flagged: false, categories: [], matches: [] })).toBeNull();
  });
});

describe("describeModerationResult", () => {
  it("names the rule without quoting the word", () => {
    const result = { categories: ["profanity" as const], matches: [{ category: "profanity" as const }] };
    expect(describeModerationResult(result, "uk")).toBe(
      "Контент не пройшов автоматичну перевірку: нецензурна лексика. Відредагуйте текст і спробуйте ще раз.",
    );
    expect(describeModerationResult(result, "en")).toBe(
      "This content didn't pass the automatic check: profanity. Edit the text and try again.",
    );
  });

  it("gives the link count", () => {
    const message = describeModerationResult(
      { categories: ["spam"], matches: [{ category: "spam", detail: "links", count: 13 }] },
      "en",
    );
    expect(message).toContain("too many links: 13");
    expect(message).toContain(String(AUTO_MODERATION_LINK_LIMIT - 1));
  });

  it("explains shouting and scams", () => {
    expect(
      describeModerationResult({ categories: ["spam"], matches: [{ category: "spam", detail: "shouting" }] }, "uk"),
    ).toContain("великими літерами");
    expect(describeModerationResult({ categories: ["scam"], matches: [{ category: "scam" }] }, "en")).toContain(
      "asking candidates to pay",
    );
  });

  it("falls back to the categories, then to the generic sentence", () => {
    expect(describeModerationResult({ categories: ["hate"] }, "en")).toContain("slurs or hate speech");
    expect(describeModerationResult(null, "en")).toBe(
      "This content didn't pass the automatic check. Edit the text and try again.",
    );
    expect(describeModerationResult({ categories: [] }, "uk")).toBe(
      "Контент не пройшов автоматичну перевірку. Відредагуйте текст і спробуйте ще раз.",
    );
  });

  it("has copy for every category", () => {
    for (const category of autoModerationCategories) {
      expect(describeModerationResult({ categories: [category] }, "uk")).not.toMatch(/undefined/);
      expect(describeModerationResult({ categories: [category] }, "en")).not.toMatch(/undefined/);
    }
  });
});

describe("isAutoModerationNote", () => {
  it("knows the database's auto note", () => {
    expect(isAutoModerationNote("[авто] Виявлено: ознаки шахрайства")).toBe(true);
    expect(isAutoModerationNote("Moved to review automatically after an urgent community report.")).toBe(false);
    expect(isAutoModerationNote(null)).toBe(false);
    expect(isAutoModerationNote(undefined)).toBe(false);
  });
});
