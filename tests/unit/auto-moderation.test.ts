import { describe, expect, it } from "vitest";
import {
  AUTO_MODERATION_BLOCKED_MESSAGE,
  AUTO_MODERATION_LINK_LIMIT,
  buildModerationNote,
  collapseObfuscation,
  collectArticleModerationText,
  collectPollModerationText,
  collectProjectModerationText,
  describeModerationResult,
  normalizeForMatch,
  screenContentForModeration,
} from "@/lib/auto-moderation";
import type { PollPayload } from "@/lib/validation/polls";
import type { ProjectPayload } from "@/lib/validation/project";

const ZWSP = String.fromCharCode(0x200b);

describe("screenContentForModeration — clean content", () => {
  it("does not flag ordinary text", () => {
    const result = screenContentForModeration([
      "My side project",
      "A small tool that helps designers organise their work.",
    ]);
    expect(result.flagged).toBe(false);
    expect(result.categories).toEqual([]);
    expect(result.note).toBeNull();
  });

  it("does not flag innocent words that merely contain a blocked substring", () => {
    // Boundaries + folding must not trip on benign words: "assistant"/"class",
    // "cockpit"/"peacock", "document" (cum), "сукня"/"соска"/"художник".
    const samples = [
      "My assistant joined the class in the cockpit.",
      "The document about the peacock is cumulative.",
      "Обговорили дизайн сукні, художник показав соску для немовляти.",
      "We will discuss the roadmap and ship it.",
    ];
    for (const sample of samples) {
      expect(screenContentForModeration([sample]).flagged).toBe(false);
    }
  });

  it("treats empty/blank input as clean", () => {
    expect(screenContentForModeration([]).flagged).toBe(false);
    expect(screenContentForModeration([null, undefined, "   "]).flagged).toBe(
      false,
    );
  });
});

describe("screenContentForModeration — blocklist", () => {
  it("flags English profanity as profanity", () => {
    const result = screenContentForModeration(["what the fuck is this"]);
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain("profanity");
  });

  it("flags Ukrainian profanity via stem (inflected forms)", () => {
    const result = screenContentForModeration(["це повна хуйня, чесно"]);
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain("profanity");
  });

  it("flags slurs as hate speech", () => {
    const result = screenContentForModeration(["you stupid faggot"]);
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain("hate");
  });

  it("flags explicit sexual terms", () => {
    const result = screenContentForModeration(["free porn videos here"]);
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain("sexual");
  });

  it("sees through light leet / symbol obfuscation", () => {
    expect(screenContentForModeration(["this is sh1t"]).flagged).toBe(true);
    expect(screenContentForModeration(["what an a$$hole"]).flagged).toBe(true);
  });

  it("sees through zero-width obfuscation", () => {
    expect(screenContentForModeration([`f${ZWSP}uck off`]).flagged).toBe(true);
  });

  it("strips HTML before scanning rich-text bodies", () => {
    const dirty = screenContentForModeration([
      "<p>go to <strong>fuck</strong> yourself</p>",
    ]);
    expect(dirty.flagged).toBe(true);

    const clean = screenContentForModeration([
      "<p>This is a <em>perfectly</em> fine sentence.</p>",
    ]);
    expect(clean.flagged).toBe(false);
  });
});

describe("screenContentForModeration — spam heuristics", () => {
  it("flags texts with too many links", () => {
    const links = Array.from(
      { length: AUTO_MODERATION_LINK_LIMIT },
      (_, i) => `https://example.com/page-${i}`,
    ).join(" ");
    const result = screenContentForModeration([`Check these out: ${links}`]);
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain("spam");
  });

  it("does not flag a handful of links", () => {
    const result = screenContentForModeration([
      "See https://example.com and https://docs.example.com for details.",
    ]);
    expect(result.flagged).toBe(false);
  });

  it("counts links by distinct URL, not by occurrence", () => {
    // The same link repeated many times (incl. trailing punctuation) is a single
    // reference, not link spam.
    const repeated = Array.from(
      { length: AUTO_MODERATION_LINK_LIMIT + 5 },
      () => "see https://example.com/post.",
    ).join(" ");
    expect(screenContentForModeration([repeated]).flagged).toBe(false);
  });

  it("does not flag a bilingual article that reuses the same links", () => {
    // EN + UK bodies cite the same references; per-occurrence counting would
    // double them and trip the limit at half the real number.
    const links = Array.from(
      { length: AUTO_MODERATION_LINK_LIMIT - 1 },
      (_, i) => `https://example.com/source-${i}`,
    ).join(" ");
    const parts = collectArticleModerationText({
      title: "Огляд інструментів",
      excerpt: null,
      content: `Корисні посилання: ${links}`,
      translations: {
        en: { title: "Tools overview", excerpt: null, content: `Useful links: ${links}` },
      },
    });
    expect(screenContentForModeration(parts).flagged).toBe(false);
  });

  it("flags sustained shouting (mostly uppercase, long text)", () => {
    const shout = "BUY NOW LIMITED OFFER ACT FAST DISCOUNT SALE ".repeat(4);
    const result = screenContentForModeration([shout]);
    expect(result.categories).toContain("spam");
  });

  it("does not flag a short all-caps acronym or title", () => {
    expect(screenContentForModeration(["NASA API DEMO"]).flagged).toBe(false);
  });
});

describe("screenContentForModeration — evasion / obfuscation", () => {
  it("flags Cyrillic profanity spoofed with a Latin homoglyph", () => {
    // "xуй" = Latin "x" + Cyrillic "уй"; folds to the same form as "хуй".
    expect(screenContentForModeration(["xуй тобі"]).flagged).toBe(true);
  });

  it("flags words spread out with spaces", () => {
    expect(screenContentForModeration(["go f u c k yourself"]).flagged).toBe(
      true,
    );
  });

  it("flags words split with separators", () => {
    expect(screenContentForModeration(["f.u.c.k this"]).flagged).toBe(true);
    expect(screenContentForModeration(["s-h-i-t happens"]).flagged).toBe(true);
  });

  it("flags Latin transliteration of Cyrillic mat", () => {
    expect(screenContentForModeration(["ty suka"]).flagged).toBe(true);
    expect(screenContentForModeration(["pizdec povnyi"]).flagged).toBe(true);
    expect(screenContentForModeration(["huilo"]).flagged).toBe(true);
  });

  it("flags the expanded vocabulary", () => {
    expect(screenContentForModeration(["what a cunt"]).categories).toContain(
      "profanity",
    );
    expect(screenContentForModeration(["go away retard"]).categories).toContain(
      "hate",
    );
    expect(
      screenContentForModeration(["це повний мудак і гандон"]).flagged,
    ).toBe(true);
  });
});

describe("match evidence", () => {
  it("records the link count for link spam", () => {
    const links = Array.from(
      { length: AUTO_MODERATION_LINK_LIMIT },
      (_, i) => `https://example.com/page-${i}`,
    ).join(" ");
    const result = screenContentForModeration([links]);
    const spam = result.matches.find((m) => m.category === "spam");
    expect(spam?.detail).toBe("links");
    expect(spam?.count).toBe(AUTO_MODERATION_LINK_LIMIT);
  });
});

describe("describeModerationResult", () => {
  it("names the profanity rule WITHOUT quoting the offending word", () => {
    const result = screenContentForModeration(["what the fuck is this"]);
    const uk = describeModerationResult(result, "uk");
    expect(uk).toContain("нецензурна лексика");
    expect(uk).not.toContain("fuck");

    const en = describeModerationResult(result, "en");
    expect(en).toContain("profanity");
    expect(en).not.toContain("fuck");
  });

  it("explains link spam with the concrete count", () => {
    const links = Array.from(
      { length: AUTO_MODERATION_LINK_LIMIT },
      (_, i) => `https://example.com/page-${i}`,
    ).join(" ");
    const result = screenContentForModeration([links]);
    const en = describeModerationResult(result, "en");
    expect(en).toContain("too many links");
    expect(en).toContain(String(AUTO_MODERATION_LINK_LIMIT));
  });

  it("falls back to bare category labels when no evidence is present", () => {
    const message = describeModerationResult(
      { categories: ["hate"] },
      "en",
    );
    expect(message).toContain("slurs or hate speech");
  });
});

describe("collapseObfuscation", () => {
  it("joins runs of single letters and strips intra-token separators", () => {
    expect(collapseObfuscation("f u c k")).toBe("fuck");
    expect(collapseObfuscation("f.u.c.k")).toBe("fuck");
  });

  it("never merges multi-letter tokens across whitespace", () => {
    expect(collapseObfuscation("this hit")).toBe("this hit");
  });
});

describe("AUTO_MODERATION_BLOCKED_MESSAGE", () => {
  it("is a non-empty user-facing string", () => {
    expect(typeof AUTO_MODERATION_BLOCKED_MESSAGE).toBe("string");
    expect(AUTO_MODERATION_BLOCKED_MESSAGE.length).toBeGreaterThan(0);
  });
});

describe("buildModerationNote", () => {
  it("returns null when nothing matched", () => {
    expect(buildModerationNote([])).toBeNull();
  });

  it("builds a human-readable Ukrainian note with the auto marker", () => {
    const note = buildModerationNote(["profanity", "spam"]);
    expect(note).toContain("[авто]");
    expect(note).toContain("нецензурна лексика");
    expect(note).toContain("ознаки спаму");
  });
});

describe("normalizeForMatch", () => {
  it("lowercases and applies leet substitutions", () => {
    expect(normalizeForMatch("SH1T")).toBe("shit");
    expect(normalizeForMatch("A$$")).toBe("ass");
  });

  it("removes zero-width characters", () => {
    expect(normalizeForMatch(`a${ZWSP}b`)).toBe("ab");
  });
});

describe("text collectors gather every screenable field", () => {
  it("collects article translations", () => {
    const parts = collectArticleModerationText({
      title: "Clean title",
      excerpt: "Clean excerpt",
      content: "<p>Clean body</p>",
      translations: {
        en: { title: "EN title", excerpt: null, content: "<p>fuck</p>" },
      },
    });
    expect(screenContentForModeration(parts).flagged).toBe(true);
  });

  it("collects poll question prompts and option labels", () => {
    const poll = {
      title: "Favourite editor?",
      excerpt: null,
      content: "",
      translations: {},
      questions: [
        {
          question_type: "single",
          prompt: "Pick one",
          prompt_uk: null,
          options: [
            { label: "VS Code", label_uk: null },
            { label: "porn", label_uk: null },
          ],
          rating_min: null,
          rating_max: null,
          multi_min: null,
          multi_max: null,
        },
      ],
    } as unknown as PollPayload;

    expect(
      screenContentForModeration(collectPollModerationText(poll)).flagged,
    ).toBe(true);
  });

  it("collects project narrative fields", () => {
    const project = {
      title: "Clean title",
      description: null,
      role: null,
      problem: null,
      solution: null,
      results: null,
      githubContribution: "I wrote some bullshit code",
      githubMotivation: null,
      githubTechDecisions: null,
      githubLearnings: null,
      githubShowcaseNotes: null,
      githubProductionUsage: null,
    } as unknown as ProjectPayload;

    expect(
      screenContentForModeration(collectProjectModerationText(project)).flagged,
    ).toBe(true);
  });
});
