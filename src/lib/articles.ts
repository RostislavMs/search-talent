import { slugify } from "@/lib/slug";

export const articleStatuses = ["draft", "published"] as const;
export const articleSortOptions = ["recent", "popular", "discussed"] as const;

/**
 * Slug of the admin-only editorial category. News lives in the same `articles`
 * table but is surfaced as its own `/news` section, so it is excluded from the
 * community Articles feed, its category filter, and the Articles RSS.
 */
export const NEWS_CATEGORY_SLUG = "news";

export function isNewsCategorySlug(slug: string | null | undefined): boolean {
  return slug === NEWS_CATEGORY_SLUG;
}

/**
 * Slug of the standalone-discussions category. Same arrangement as News: the
 * rows live in `articles`, but the section owns `/discussions`, so they are kept
 * out of the community Articles feed and its RSS.
 */
export const DISCUSSIONS_CATEGORY_SLUG = "discussions";

export function isDiscussionsCategorySlug(
  slug: string | null | undefined,
): boolean {
  return slug === DISCUSSIONS_CATEGORY_SLUG;
}

/**
 * Categories that have a section of their own and must therefore never appear
 * in the generic Articles feed. Uncategorised articles still show through.
 */
export const SECTION_CATEGORY_SLUGS = [
  NEWS_CATEGORY_SLUG,
  DISCUSSIONS_CATEGORY_SLUG,
] as const;

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
  /**
   * Precomputed on the server instead of shipping the article body.
   *
   * Cards only ever needed the body to count its words for the reading-time
   * label, but `ArticleFeedItem` crosses into a client component — so the full
   * rich-text of up to 60 articles, in both languages, was being serialized into
   * the RSC payload. That put /articles at 1.1MB of HTML, 90% of it inline
   * script. The count travels instead of the text.
   */
  readingMinutes: number;
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
  mediaUrl: string | null;
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
  /**
   * True when the requested locale has no version of its own and the reader is
   * seeing the primary language instead. Such a URL is served but not indexed —
   * see `hasOwnLocaleVersion` in `@/lib/db/articles`.
   */
  isLocaleFallback: boolean;
  /** Last post-publish edit time; null until an already-published article is edited. */
  editedAt: string | null;
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
  return slugify(value, "article");
}

/**
 * Resolve the cover to display for an article in a listing: prefer the primary
 * (top-level) cover, then fall back to any translation's cover. Lets a cover
 * uploaded on only one language tab still appear in profile / article lists,
 * which read the row directly instead of going through pickLocalizedVersion.
 */
export function resolveArticleListCover(
  coverImageUrl: string | null,
  translations:
    | Record<string, { cover_image_url?: string | null } | null>
    | null
    | undefined,
): string | null {
  if (coverImageUrl) return coverImageUrl;
  for (const version of Object.values(translations ?? {})) {
    if (version?.cover_image_url) return version.cover_image_url;
  }
  return null;
}

type ArticleListLocalizable = {
  title: string;
  excerpt: string | null;
  cover_image_url: string | null;
  content_locale?: string | null;
  translations?:
    | Record<
        string,
        {
          title?: string;
          excerpt?: string | null;
          content?: string;
          cover_image_url?: string | null;
        } | null
      >
    | null;
};

/**
 * Localize an article's list-card fields (title, excerpt, cover) for a viewing
 * locale, mirroring pickLocalizedVersion: use the locale's translation when it
 * has real content, otherwise fall back to the primary fields. Used by profile
 * / article listings that read article rows directly instead of going through
 * pickLocalizedVersion. Cover priority: chosen version's own → primary → any
 * translation, so a single uploaded image still shows.
 */
export function localizeArticleListFields(
  row: ArticleListLocalizable,
  locale?: string | null,
): { title: string; excerpt: string | null; cover_image_url: string | null } {
  let title = row.title;
  let excerpt = row.excerpt;
  let cover = row.cover_image_url;
  const primaryLocale = row.content_locale || "uk";

  if (locale && locale !== primaryLocale) {
    const alt = row.translations?.[locale];
    if (alt && (alt.title?.trim() || alt.content?.trim())) {
      title = alt.title?.trim() ? alt.title : row.title;
      excerpt = alt.excerpt ?? null;
      cover = alt.cover_image_url ?? null;
    }
  }

  return {
    title,
    excerpt,
    cover_image_url:
      cover ?? resolveArticleListCover(row.cover_image_url, row.translations),
  };
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

/**
 * Does this article carry its own version in `locale`?
 *
 * A missing translation falls back to the primary language when rendering, which
 * is the right call for a reader who followed a link — but such a URL must not be
 * indexed: it declares `lang="en"` and an `en` hreflang while serving Ukrainian
 * text. The test is deliberately stricter than the render-time fallback's: a
 * translated title over a primary-language body is still a wrong-language page,
 * so both fields have to be present.
 *
 * Lives here rather than in the DB layer because the page metadata and the
 * sitemap both depend on it, and the two must not drift.
 */
export function hasOwnLocaleVersion(
  source: {
    content_locale?: string | null;
    translations?: Record<
      string,
      { title?: string | null; content?: string | null } | null | undefined
    > | null;
  },
  locale: string | null | undefined,
): boolean {
  const primaryLocale = source.content_locale || "uk";

  if (!locale || locale === primaryLocale) {
    return true;
  }

  const alt = source.translations?.[locale];

  return Boolean(alt?.title?.trim() && alt?.content?.trim());
}

/** Reading time in whole minutes, at 180 words per minute. */
export function getReadingMinutes(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;

  return Math.max(1, Math.round(words / 180));
}

export function formatReadingTime(minutes: number, locale: string) {
  return locale === "uk" ? `${minutes} хв читання` : `${minutes} min read`;
}

/**
 * Reading-time label straight from the body. Used on detail pages, which already
 * hold the content; listings carry `readingMinutes` instead and go through
 * `formatReadingTime`.
 */
export function getArticleReadingTime(content: string, locale: string) {
  return formatReadingTime(getReadingMinutes(content), locale);
}
