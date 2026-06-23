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

export function getArticleReadingTime(content: string, locale: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 180));

  return locale === "uk" ? `${minutes} хв читання` : `${minutes} min read`;
}
