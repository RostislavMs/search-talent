import { describe, expect, it } from "vitest";
import {
  buildDiscussionParentPath,
  buildDiscussionPath,
  DISCUSSION_COMMENT_THRESHOLD,
  DISCUSSION_CONTENT_KINDS,
  DISCUSSION_PREVIEW_LIMIT,
  formatCommentCount,
  isDiscussionOpen,
} from "@/lib/discussions";
import { excludeSectionCategories } from "@/lib/db/article-sections";
import {
  DISCUSSIONS_CATEGORY_SLUG,
  NEWS_CATEGORY_SLUG,
  SECTION_CATEGORY_SLUGS,
} from "@/lib/articles";

describe("isDiscussionOpen", () => {
  it("stays closed below the threshold", () => {
    expect(isDiscussionOpen(0)).toBe(false);
    expect(isDiscussionOpen(DISCUSSION_COMMENT_THRESHOLD - 1)).toBe(false);
  });

  it("opens at the threshold and stays open above it", () => {
    expect(isDiscussionOpen(DISCUSSION_COMMENT_THRESHOLD)).toBe(true);
    expect(isDiscussionOpen(DISCUSSION_COMMENT_THRESHOLD + 50)).toBe(true);
  });
});

describe("discussion paths", () => {
  it("builds a nested discussion path per content kind", () => {
    expect(buildDiscussionPath("project", "my-app")).toBe(
      "/projects/my-app/discussion",
    );
    expect(buildDiscussionPath("article", "my-post")).toBe(
      "/articles/my-post/discussion",
    );
    expect(buildDiscussionPath("poll", "my-poll")).toBe(
      "/polls/my-poll/discussion",
    );
  });

  it("points the parent path at the content itself", () => {
    expect(buildDiscussionParentPath("project", "my-app")).toBe(
      "/projects/my-app",
    );
  });

  it("escapes slugs so a crafted slug cannot break out of the route", () => {
    expect(buildDiscussionPath("article", "a/b?c")).toBe(
      "/articles/a%2Fb%3Fc/discussion",
    );
  });

  it("covers every declared content kind", () => {
    for (const kind of DISCUSSION_CONTENT_KINDS) {
      expect(buildDiscussionPath(kind, "slug")).toMatch(
        /^\/[a-z]+\/slug\/discussion$/,
      );
    }
  });
});

describe("formatCommentCount", () => {
  it("uses the three-way Ukrainian plural", () => {
    expect(formatCommentCount(1, "uk")).toBe("1 коментар");
    expect(formatCommentCount(3, "uk")).toBe("3 коментарі");
    expect(formatCommentCount(5, "uk")).toBe("5 коментарів");
    // The teens are the case a naive mod-10 rule gets wrong.
    expect(formatCommentCount(11, "uk")).toBe("11 коментарів");
    expect(formatCommentCount(22, "uk")).toBe("22 коментарі");
    expect(formatCommentCount(112, "uk")).toBe("112 коментарів");
  });

  it("uses the two-way English plural", () => {
    expect(formatCommentCount(1, "en")).toBe("1 comment");
    expect(formatCommentCount(0, "en")).toBe("0 comments");
    expect(formatCommentCount(11, "en")).toBe("11 comments");
  });
});

describe("excludeSectionCategories", () => {
  it("covers both sections that own a route", () => {
    expect([...SECTION_CATEGORY_SLUGS]).toEqual([
      NEWS_CATEGORY_SLUG,
      DISCUSSIONS_CATEGORY_SLUG,
    ]);
  });

  it("keeps uncategorised articles, which PostgREST would otherwise drop", () => {
    const applied: string[] = [];
    const query = {
      or(expression: string) {
        applied.push(expression);
        return this;
      },
    };

    excludeSectionCategories(query, [3, 9]);

    expect(applied).toEqual(["category_id.is.null,category_id.not.in.(3,9)"]);
  });

  it("leaves the query untouched when no section categories exist", () => {
    const applied: string[] = [];
    const query = {
      or(expression: string) {
        applied.push(expression);
        return this;
      },
    };

    expect(excludeSectionCategories(query, [])).toBe(query);
    expect(applied).toEqual([]);
  });
});

describe("preview limit", () => {
  // The preview must never be able to show the whole thread of a freshly
  // promoted one, or the call-to-action would appear with nothing behind it.
  it("is not larger than the promotion threshold", () => {
    expect(DISCUSSION_PREVIEW_LIMIT).toBeLessThanOrEqual(
      DISCUSSION_COMMENT_THRESHOLD,
    );
  });
});
