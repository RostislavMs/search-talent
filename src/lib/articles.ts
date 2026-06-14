export const articleStatuses = ["draft", "published"] as const;
export const articleSortOptions = ["recent", "popular", "discussed"] as const;

export type ArticleStatus = (typeof articleStatuses)[number];
export type ArticleSortOption = (typeof articleSortOptions)[number];

export type ArticleCategory = {
  id: number;
  slug: string;
  name: string;
  nameUk: string | null;
  description: string | null;
  adminOnly: boolean;
};

export type ArticleAuthor = {
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type ArticleFeedItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  heroVideoUrl: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  category: ArticleCategory | null;
  author: ArticleAuthor | null;
  authorDeleted: boolean;
  pinnedUntil: string | null;
  /** Accepted co-authors (excludes the primary author). Empty/undefined for solo work. */
  coAuthors?: import("@/lib/co-authors").ContentAuthor[];
};

export type ArticleComment = {
  id: string;
  parentId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: string | null;
  author: ArticleAuthor | null;
  authorDeleted: boolean;
  replies: ArticleComment[];
  reactions?: import("@/lib/constants/reactions").ReactionSummary[];
};

export type ArticleDetail = ArticleFeedItem & {
  status: ArticleStatus;
  moderationStatus: string | null;
  moderationNote: string | null;
  content: string;
  coverImageStoragePath: string | null;
  heroVideoStoragePath: string | null;
  currentUserLiked: boolean;
  reactions: import("@/lib/constants/reactions").ReactionSummary[];
  comments: ArticleComment[];
};

export type ArticleDashboardItem = {
  id: string;
  slug: string;
  title: string;
  status: ArticleStatus;
  createdAt: string | null;
  publishedAt: string | null;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  category: ArticleCategory | null;
  moderationStatus: string | null;
  moderationNote: string | null;
};

export function normalizeArticleStatus(value: unknown): ArticleStatus {
  return typeof value === "string" && articleStatuses.includes(value as ArticleStatus)
    ? (value as ArticleStatus)
    : "draft";
}

export function normalizeArticleSort(value: unknown): ArticleSortOption {
  return typeof value === "string" && articleSortOptions.includes(value as ArticleSortOption)
    ? (value as ArticleSortOption)
    : "recent";
}

export function slugifyArticleTitle(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9\s-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "article"
  );
}

export function formatArticleDate(value: string | null, locale: string) {
  if (!value) {
    return locale === "uk" ? "Без дати" : "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getCategoryDisplayName(category: ArticleCategory | null, locale: string) {
  if (!category) return locale === "uk" ? "Без категорії" : "No category";
  if (locale === "uk" && category.nameUk?.trim()) return category.nameUk;
  return category.name;
}

export function sortArticleCategories(
  categories: ArticleCategory[],
  locale: string,
) {
  const collator = new Intl.Collator(locale === "uk" ? "uk-UA" : "en-US", {
    sensitivity: "base",
  });

  return [...categories].sort((left, right) =>
    collator.compare(
      getCategoryDisplayName(left, locale),
      getCategoryDisplayName(right, locale),
    ),
  );
}

export function getArticleReadingTime(content: string, locale: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));

  return locale === "uk" ? `${minutes} хв читання` : `${minutes} min read`;
}
