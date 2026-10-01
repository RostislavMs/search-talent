import { SECTION_VISIBILITY_THRESHOLDS } from "@/lib/constants/visibility";

/** Raw activity counts the visibility rules are decided from. */
export type SectionCounts = {
  publishedPolls: number;
  pollAuthors: number;
  discussionTopicsAndThreads: number;
  recentNews: number;
  publicProfiles: number;
  openVacancies: number;
  vacancyCompanies: number;
};

/** Which audience-dependent sections are advertised in the navigation. */
export type SectionVisibility = {
  polls: boolean;
  discussions: boolean;
  news: boolean;
  analytics: boolean;
  jobs: boolean;
};

/**
 * Used when the counts cannot be read. Failing open keeps the navigation
 * exactly as it was before thresholds existed instead of silently dropping
 * sections because of a transient database error. Vacancies are the exception:
 * the navigation never had them, so they stay out until they are counted.
 */
export const ALL_SECTIONS_VISIBLE: SectionVisibility = {
  polls: true,
  discussions: true,
  news: true,
  analytics: true,
  jobs: false,
};

export function resolveSectionVisibility(
  counts: SectionCounts,
): SectionVisibility {
  const { polls, discussions, news, analytics, jobs } = SECTION_VISIBILITY_THRESHOLDS;

  return {
    polls:
      counts.publishedPolls >= polls.minPublished &&
      counts.pollAuthors >= polls.minAuthors,
    discussions:
      counts.discussionTopicsAndThreads >= discussions.minTopicsAndThreads,
    news: counts.recentNews >= news.minRecent,
    analytics: counts.publicProfiles >= analytics.minProfiles,
    jobs:
      counts.openVacancies >= jobs.minOpen &&
      counts.vacancyCompanies >= jobs.minCompanies,
  };
}
