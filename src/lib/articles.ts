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

// Cyrillic → Latin map for slugs. Ukrainian-first (BGN/PCGN-ish: я→ya, ю→yu,
// є→ye, ї→yi, й→y) so Ukrainian titles produce readable Latin slugs instead of
// collapsing to the "article" fallback. A few Russian-only letters are included
// so mixed input still transliterates.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ye",
  ж: "zh", з: "z", и: "y", і: "i", ї: "yi", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ь: "",
  ю: "yu", я: "ya", ё: "e", ъ: "", ы: "y", э: "e",
};

function transliterateCyrillic(value: string) {
  let out = "";
  for (const char of value) {
    out += CYRILLIC_TO_LATIN[char] ?? char;
  }
  return out;
}

export function slugifyArticleTitle(value: string) {
  return (
    transliterateCyrillic(value.trim().toLowerCase())
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
