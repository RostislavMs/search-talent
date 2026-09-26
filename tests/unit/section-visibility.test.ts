import { describe, expect, it } from "vitest";
import { SECTION_VISIBILITY_THRESHOLDS } from "@/lib/constants/visibility";
import {
  resolveSectionVisibility,
  type SectionCounts,
} from "@/lib/section-visibility";

const EMPTY: SectionCounts = {
  publishedPolls: 0,
  pollAuthors: 0,
  discussionTopicsAndThreads: 0,
  recentNews: 0,
  publicProfiles: 0,
};

const { polls, discussions, news, analytics } = SECTION_VISIBILITY_THRESHOLDS;

describe("resolveSectionVisibility", () => {
  it("hides every audience-dependent section on an empty platform", () => {
    expect(resolveSectionVisibility(EMPTY)).toEqual({
      polls: false,
      discussions: false,
      news: false,
      analytics: false,
    });
  });

  it("shows each section exactly at its threshold", () => {
    expect(
      resolveSectionVisibility({
        publishedPolls: polls.minPublished,
        pollAuthors: polls.minAuthors,
        discussionTopicsAndThreads: discussions.minTopicsAndThreads,
        recentNews: news.minRecent,
        publicProfiles: analytics.minProfiles,
      }),
    ).toEqual({ polls: true, discussions: true, news: true, analytics: true });
  });

  it("keeps polls hidden while one author writes them all", () => {
    const visibility = resolveSectionVisibility({
      ...EMPTY,
      publishedPolls: polls.minPublished * 3,
      pollAuthors: 1,
    });
    expect(visibility.polls).toBe(false);
  });

  it("keeps polls hidden when many authors published too few polls", () => {
    const visibility = resolveSectionVisibility({
      ...EMPTY,
      publishedPolls: polls.minPublished - 1,
      pollAuthors: polls.minAuthors,
    });
    expect(visibility.polls).toBe(false);
  });

  it("decides each section independently", () => {
    const visibility = resolveSectionVisibility({
      ...EMPTY,
      recentNews: news.minRecent,
    });
    expect(visibility).toEqual({
      polls: false,
      discussions: false,
      news: true,
      analytics: false,
    });
  });
});
