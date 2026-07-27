import {
  getProfileCategoryDirectory,
  getProjectKindDirectory,
  getTalentSkillDirectory,
  getTechnologyDirectory,
} from "@/lib/db/marketing";
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
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/talents", changeFrequency: "daily", priority: 0.9 },
  { path: "/projects", changeFrequency: "daily", priority: 0.9 },
  { path: "/articles", changeFrequency: "daily", priority: 0.9 },
  // Facet directory hubs — link the long-tail facet pages so they are not
  // orphaned (reachable only via the sitemap). See /talents/skill etc.
  { path: "/talents/skill", changeFrequency: "weekly", priority: 0.6 },
  { path: "/talents/role", changeFrequency: "weekly", priority: 0.6 },
  { path: "/projects/tag", changeFrequency: "weekly", priority: 0.6 },
  { path: "/polls", changeFrequency: "weekly", priority: 0.8 },
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
  } = {},
): SitemapEntry[] {
  const alternates: SitemapEntry["alternates"] = [
    ...locales.map((locale) => ({
      locale,
      href: new URL(createLocalePath(locale, route), baseUrl).toString(),
    })),
    {
      locale: "x-default" as const,
      href: new URL(createLocalePath(xDefaultLocale, route), baseUrl).toString(),
    },
  ];

  return locales.map((locale) => ({
    url: new URL(createLocalePath(locale, route), baseUrl).toString(),
    lastModified: options.lastModified,
    changeFrequency: options.changeFrequency,
    priority: options.priority,
    alternates,
  }));
}

export async function getSitemapEntries(id: SitemapId): Promise<SitemapEntry[]> {
  const baseUrl = getMetadataBase();

  if (id === "static") {
    return staticRoutes.flatMap((route) =>
      buildEntries(baseUrl, route.path, {
        lastModified: STATIC_LASTMOD,
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
    const { data } = await supabase
      .from("articles")
      .select("slug, updated_at")
      .eq("status", "published")
      .eq("moderation_status", "approved")
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_PAGE_SIZE);

    return (data || []).flatMap((article) =>
      buildEntries(baseUrl, `/articles/${article.slug}`, {
        lastModified: new Date(article.updated_at),
        changeFrequency: "monthly",
        priority: 0.7,
      }),
    );
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
