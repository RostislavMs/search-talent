export const pollStatuses = ["draft", "published"] as const;
export const pollSortOptions = ["recent", "popular", "discussed"] as const;
export const pollQuestionTypes = ["single", "multiple", "rating"] as const;

export type PollStatus = (typeof pollStatuses)[number];
export type PollSortOption = (typeof pollSortOptions)[number];
export type PollQuestionType = (typeof pollQuestionTypes)[number];

export type PollCategory = {
  id: number;
  slug: string;
  name: string;
  nameUk: string | null;
  description: string | null;
  adminOnly: boolean;
};

export type PollAuthor = {
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type PollOption = {
  id: string;
  label: string;
  position: number;
  // Tallies are only populated when results are visible to the viewer.
  votesCount: number;
  selected: boolean;
};

export type PollQuestion = {
  id: string;
  type: PollQuestionType;
  prompt: string;
  position: number;
  ratingMin: number | null;
  ratingMax: number | null;
  multiMin: number | null;
  multiMax: number | null;
  options: PollOption[];
  // Tallies — only populated when results are visible.
  responsesCount: number;
  ratingAverage: number | null;
  // The viewer's own answer, when they have voted.
  selectedOptionIds: string[];
  selectedRating: number | null;
};

export type PollFeedItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  closesAt: string | null;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  responsesCount: number;
  questionCount: number;
  category: PollCategory | null;
  author: PollAuthor | null;
  authorDeleted: boolean;
  pinnedUntil: string | null;
  /** Accepted co-authors (excludes the primary author). Empty/undefined for solo work. */
  coAuthors?: import("@/lib/co-authors").ContentAuthor[];
};

export type PollComment = {
  id: string;
  parentId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: string | null;
  author: PollAuthor | null;
  authorDeleted: boolean;
  replies: PollComment[];
};

export type PollDetail = PollFeedItem & {
  status: PollStatus;
  moderationStatus: string | null;
  moderationNote: string | null;
  content: string;
  coverImageStoragePath: string | null;
  currentUserLiked: boolean;
  hasVoted: boolean;
  isClosed: boolean;
  resultsVisible: boolean;
  questions: PollQuestion[];
  comments: PollComment[];
};

export type PollDashboardItem = {
  id: string;
  slug: string;
  title: string;
  status: PollStatus;
  createdAt: string | null;
  publishedAt: string | null;
  closesAt: string | null;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  responsesCount: number;
  category: PollCategory | null;
  moderationStatus: string | null;
  moderationNote: string | null;
};

export function normalizePollStatus(value: unknown): PollStatus {
  return typeof value === "string" && pollStatuses.includes(value as PollStatus)
    ? (value as PollStatus)
    : "draft";
}

export function normalizePollSort(value: unknown): PollSortOption {
  return typeof value === "string" && pollSortOptions.includes(value as PollSortOption)
    ? (value as PollSortOption)
    : "recent";
}

export function normalizePollQuestionType(value: unknown): PollQuestionType {
  return typeof value === "string" && pollQuestionTypes.includes(value as PollQuestionType)
    ? (value as PollQuestionType)
    : "single";
}

export function slugifyPollTitle(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "poll"
  );
}

export function isPollClosed(closesAt: string | null): boolean {
  if (!closesAt) return false;
  const date = new Date(closesAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}

export function getPollClosesLabel(closesAt: string | null, locale: string) {
  if (!closesAt) {
    return locale === "uk" ? "Без обмеження часу" : "No time limit";
  }

  const date = new Date(closesAt);
  if (Number.isNaN(date.getTime())) return closesAt;

  const formatted = new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  if (isPollClosed(closesAt)) {
    return locale === "uk" ? `Завершено ${formatted}` : `Closed ${formatted}`;
  }

  return locale === "uk" ? `Активне до ${formatted}` : `Open until ${formatted}`;
}
