/**
 * Visibility thresholds. Surfaces that only make sense with an audience stay
 * out of the navigation and the home page until the platform has enough real
 * activity to fill them, so a first-time visitor never lands on zero counters,
 * an empty poll feed or a leaderboard padded with blank profiles.
 *
 * Every page keeps working behind its direct URL — these numbers only decide
 * what is advertised. Raising or lowering a threshold is the whole change.
 */

// ---- home leaderboards ------------------------------------------------------

/** How many rows each home leaderboard shows. */
export const LEADERBOARD_DISPLAY_SIZE = 10;

/** A creator enters "Top 10" only with real published work… */
export const TOP_CREATOR_MIN_PUBLISHED_PROJECTS = 1;

/** …and a mostly filled-out profile (percent, same scale as the UI pill). */
export const TOP_CREATOR_MIN_COMPLETENESS_PERCENT = 60;

/**
 * Below this many qualifying creators a ranking is not a ranking yet: the home
 * block lists the newest portfolios instead of numbering a handful of people.
 */
export const TOP_CREATORS_MIN_BOARD_SIZE = 5;

/** Keeps one prolific author from filling the whole "Top 10 projects". */
export const TOP_PROJECTS_MAX_PER_OWNER = 2;

// ---- navigation sections ----------------------------------------------------

export const SECTION_VISIBILITY_THRESHOLDS = {
  /** Published polls, and how many different people must have written them. */
  polls: { minPublished: 10, minAuthors: 5 },
  /** Standalone topics plus comment threads promoted to their own page. */
  discussions: { minTopicsAndThreads: 20 },
  /** Published news posts within the recent window. */
  news: { minRecent: 5, windowDays: 90 },
  /** Public profiles before platform-wide analytics says anything real. */
  analytics: { minProfiles: 100 },
} as const;

/** How long the section counts are cached before they are recounted. */
export const SECTION_VISIBILITY_REVALIDATE_SECONDS = 600;

// ---- counters & aggregates ---------------------------------------------------

/** Community counters (topics, threads, comments) render from this value up. */
export const COMMUNITY_COUNTER_MIN_VALUE = 10;

/**
 * Smallest group a salary aggregate is shown for. Averages over a handful of
 * people are both noise and a de-anonymisation risk.
 */
export const SALARY_STATS_MIN_GROUP_SIZE = 10;
