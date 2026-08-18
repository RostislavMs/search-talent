import {
  getProfileCategoryDirectory,
  getProjectKindDirectory,
  getTalentSkillDirectory,
  getTechnologyDirectory,
} from "@/lib/db/marketing";
import {
  DISCUSSIONS_CATEGORY_SLUG,
  NEWS_CATEGORY_SLUG,
  hasOwnLocaleVersion,
} from "@/lib/articles";
import { normalizeProjectKind } from "@/lib/projects";
import {
  createLocalePath,
  locales,
  xDefaultLocale,
  type Locale,
} from "@/lib/i18n/config";
import {
  getMetadataBase,
  isProfileIndexable,
  isProjectIndexable,
} from "@/lib/seo";
import { createServerClient } from "@supabase/ssr";

// Read-only Supabase client for the sitemap. It only reads public
// (approved/published) rows, so it needs no auth cookies — and by not calling
// `cookies()` it keeps the response free of per-user variance, which is what
// lets the sitemap route be cached at the CDN instead of regenerated on every
// hit. (The cookie-based `@/lib/supabase/server` client would force that.)
function createSitemapClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export const SITEMAP_IDS = [
  "static",
  "profiles",
  "projects",
  "articles",
  "polls",
  "project-tags",
  "project-types",
  "talent-skills",
  "talent-roles",
] as const;

export type SitemapId = (typeof SITEMAP_IDS)[number];

type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: ChangeFrequency;
  priority?: number;
  alternates: Array<{ locale: Locale | "x-default"; href: string }>;
};

const SITEMAP_PAGE_SIZE = 5000;
const MIN_ITEMS_FOR_PROGRAMMATIC_PAGE = 5;
const MIN_TALENT_ITEMS_FOR_PAGE = 3;
const MIN_PROJECT_TYPE_ITEMS_FOR_PAGE = 3;

// Stable lastmod for static/legal/info pages — bump when their content
// actually changes (avoids signalling "updated" on every sitemap render).
const STATIC_LASTMOD = new Date("2026-06-13T00:00:00.000Z");

const staticRoutes: Array<{
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
  /**
   * Listing pages change whenever anyone publishes, so a frozen STATIC_LASTMOD
   * on them is a false signal — "changes daily" next to a months-old lastmod.
   * Google ignores changefreq and trusts lastmod, so these omit it entirely
   * rather than assert a date that is wrong either way. Only genuinely static
   * copy (legal, info) keeps the frozen date.
   */
  listing?: boolean;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1, listing: true },
  { path: "/talents", changeFrequency: "daily", priority: 0.9, listing: true },
  { path: "/projects", changeFrequency: "daily", priority: 0.9, listing: true },
  { path: "/articles", changeFrequency: "daily", priority: 0.9, listing: true },
  // News is an indexable section of its own (`index, follow`) and was missing
  // from the sitemap entirely — only its individual posts were listed.
  { path: "/news", changeFrequency: "weekly", priority: 0.7, listing: true },
  // Facet directory hubs — link the long-tail facet pages so they are not
  // orphaned (reachable only via the sitemap). See /talents/skill etc.
  { path: "/talents/skill", changeFrequency: "weekly", priority: 0.6, listing: true },
  { path: "/talents/role", changeFrequency: "weekly", priority: 0.6, listing: true },
  { path: "/projects/tag", changeFrequency: "weekly", priority: 0.6, listing: true },
  { path: "/polls", changeFrequency: "weekly", priority: 0.8, listing: true },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/rating-guide", changeFrequency: "monthly", priority: 0.5 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contacts", changeFrequency: "yearly", priority: 0.4 },
  { path: "/legal", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.3 },
];

// Emit one <url> entry per locale (not just the default). Google's hreflang
// sitemap format requires every language version to have its own <loc> with the
// full alternates set — a uk-only sitemap leaves the /en pages without lastmod
// signals and reliant on in-page hreflang alone for discovery.
function buildEntries(
  baseUrl: URL,
  route: string,
  options: {
    lastModified?: Date;
    changeFrequency?: ChangeFrequency;
    priority?: number;
    /**
     * Restrict the entry (and its alternates) to the locales that actually have
     * their own version of this content. Defaults to every locale.
     *
     * Translated content is served in every locale, but an untranslated article
     * falls back to its primary language — so its /en/ URL declares `lang="en"`
     * and an `en` hreflang while serving Ukrainian text. Those URLs are
     * `noindex` at the page level, and a noindex URL must never appear in the
     * sitemap or in another page's hreflang cluster.
     */
    availableLocales?: readonly Locale[];
  } = {},
): SitemapEntry[] {
  const available =
    options.availableLocales && options.availableLocales.length > 0
      ? locales.filter((locale) => options.availableLocales!.includes(locale))
      : locales;

  if (available.length === 0) {
    return [];
  }

  // x-default has to name a URL that exists: when the default locale is the
  // missing one, the remaining version is the only sensible target.
  const defaultLocale = available.includes(xDefaultLocale)
    ? xDefaultLocale
    : available[0];

  const alternates: SitemapEntry["alternates"] = [
    ...available.map((locale) => ({
      locale,
      href: new URL(createLocalePath(locale, route), baseUrl).toString(),
    })),
    {
      locale: "x-default" as const,
      href: new URL(createLocalePath(defaultLocale, route), baseUrl).toString(),
    },
  ];

  return available.map((locale) => ({
    url: new URL(createLocalePath(locale, route), baseUrl).toString(),
    lastModified: options.lastModified,
    changeFrequency: options.changeFrequency,
    priority: options.priority,
    alternates,
  }));
}

/** Locales this article has a version of its own in — see `hasOwnLocaleVersion`. */
function getArticleLocales(article: {
  content_locale?: string | null;
  translations?: unknown;
}): Locale[] {
  const source = {
    content_locale: article.content_locale,
    translations: (article.translations ?? null) as Parameters<
      typeof hasOwnLocaleVersion
    >[0]["translations"],
  };

  return locales.filter((locale) => hasOwnLocaleVersion(source, locale));
}

export async function getSitemapEntries(id: SitemapId): Promise<SitemapEntry[]> {
  const baseUrl = getMetadataBase();

  if (id === "static") {
    return staticRoutes.flatMap((route) =>
      buildEntries(baseUrl, route.path, {
        ...(route.listing ? {} : { lastModified: STATIC_LASTMOD }),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
      }),
    );
  }

  if (id === "project-tags") {
    const items = await getTechnologyDirectory(200);
    return items
      .filter((item) => item.count >= MIN_ITEMS_FOR_PROGRAMMATIC_PAGE)
      .flatMap((item) =>
        buildEntries(baseUrl, `/projects/tag/${item.slug}`, {
          changeFrequency: "weekly",
          priority: 0.5,
        }),
      );
  }

  if (id === "project-types") {
    const items = await getProjectKindDirectory();
    return items
      .filter(
        (item) =>
          normalizeProjectKind(item.kind) !== null &&
          item.count >= MIN_PROJECT_TYPE_ITEMS_FOR_PAGE,
      )
      .flatMap((item) =>
        buildEntries(baseUrl, `/projects/type/${item.kind}`, {
          changeFrequency: "weekly",
          priority: 0.5,
        }),
      );
  }

  if (id === "talent-skills") {
    const items = await getTalentSkillDirectory();
    return items
      .filter((item) => item.count >= MIN_TALENT_ITEMS_FOR_PAGE)
      .flatMap((item) =>
        buildEntries(baseUrl, `/talents/skill/${item.slug}`, {
          changeFrequency: "weekly",
          priority: 0.5,
        }),
      );
  }

  if (id === "talent-roles") {
    const items = await getProfileCategoryDirectory();
    return items
      .filter((item) => item.count >= MIN_TALENT_ITEMS_FOR_PAGE)
      .flatMap((item) =>
        buildEntries(baseUrl, `/talents/role/${item.slug}`, {
          changeFrequency: "weekly",
          priority: 0.5,
        }),
      );
  }

  const supabase = createSitemapClient();

  if (id === "profiles") {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, bio, updated_at")
      .eq("moderation_status", "approved")
      .not("username", "is", null)
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_PAGE_SIZE);

    // A profile is noindex (and so must stay out of the sitemap) when it has no
    // visible projects and no bio — mirror the page's thin-content rule. We only
    // need to know which owners have at least one public project.
    const { data: projectOwners } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("moderation_status", "approved")
      .eq("status", "published");

    const ownersWithProjects = new Set(
      (projectOwners || []).map((row) => row.owner_id),
    );

    return (data || [])
      .filter((profile) =>
        isProfileIndexable({
          projectCount: ownersWithProjects.has(profile.user_id) ? 1 : 0,
          bio: profile.bio,
        }),
      )
      .flatMap((profile) =>
        buildEntries(baseUrl, `/u/${profile.username}`, {
          lastModified: new Date(profile.updated_at),
          changeFrequency: "weekly",
          priority: 0.7,
        }),
      );
  }

  if (id === "projects") {
    const { data } = await supabase
      .from("projects")
      .select(
        "slug, updated_at, description, problem, solution, results, github_contribution, github_motivation, github_tech_decisions, github_learnings, github_showcase_notes, github_production_usage",
      )
      .eq("moderation_status", "approved")
      .eq("status", "published")
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_PAGE_SIZE);

    // A project page is noindex when its combined narrative is under the word
    // threshold — keep those thin projects out of the sitemap (same rule as the
    // page metadata, via the shared predicate).
    return (data || [])
      .filter((project) => isProjectIndexable(project))
      .flatMap((project) =>
        buildEntries(baseUrl, `/projects/${project.slug}`, {
          lastModified: new Date(project.updated_at),
          changeFrequency: "weekly",
          priority: 0.8,
        }),
      );
  }

  if (id === "articles") {
    // Discussion topics are `noindex` by product decision, and a noindex page
    // must never appear in the sitemap. News is deliberately NOT excluded here:
    // it has no sitemap section of its own, so dropping it would take news out
    // of the sitemap entirely. It is emitted under /news/<slug> below, which is
    // the URL the news post canonicalizes to.
    const { data: sectionCategories } = await supabase
      .from("article_categories")
      .select("id, slug")
      .in("slug", [DISCUSSIONS_CATEGORY_SLUG, NEWS_CATEGORY_SLUG]);

    const discussionsCategoryId =
      sectionCategories?.find((row) => row.slug === DISCUSSIONS_CATEGORY_SLUG)
        ?.id ?? null;
    const newsCategoryId =
      sectionCategories?.find((row) => row.slug === NEWS_CATEGORY_SLUG)?.id ??
      null;

    let articlesQuery = supabase
      .from("articles")
      .select("slug, updated_at, category_id, content_locale, translations")
      .eq("status", "published")
      .eq("moderation_status", "approved");

    if (discussionsCategoryId !== null) {
      articlesQuery = articlesQuery.or(
        `category_id.is.null,category_id.neq.${discussionsCategoryId}`,
      );
    }

    const { data } = await articlesQuery
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_PAGE_SIZE);

    return (data || []).flatMap((article) => {
      const isNews =
        newsCategoryId !== null && article.category_id === newsCategoryId;

      return buildEntries(
        baseUrl,
        `${isNews ? "/news" : "/articles"}/${article.slug}`,
        {
          lastModified: new Date(article.updated_at),
          changeFrequency: "monthly",
          priority: 0.7,
          availableLocales: getArticleLocales(article),
        },
      );
    });
  }

  if (id === "polls") {
    const { data } = await supabase
      .from("polls")
      .select("slug, updated_at")
      .eq("status", "published")
      .eq("moderation_status", "approved")
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_PAGE_SIZE);

    return (data || []).flatMap((poll) =>
      buildEntries(baseUrl, `/polls/${poll.slug}`, {
        lastModified: new Date(poll.updated_at),
        changeFrequency: "weekly",
        priority: 0.6,
      }),
    );
  }

  return [];
}
