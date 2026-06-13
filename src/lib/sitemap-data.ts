import {
  getProfileCategoryDirectory,
  getProjectKindDirectory,
  getTalentSkillDirectory,
  getTechnologyDirectory,
} from "@/lib/db/marketing";
import { normalizeProjectKind } from "@/lib/projects";
import {
  createLocalePath,
  defaultLocale,
  locales,
  type Locale,
} from "@/lib/i18n/config";
import { getMetadataBase } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

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

function buildEntry(
  baseUrl: URL,
  route: string,
  options: {
    lastModified?: Date;
    changeFrequency?: ChangeFrequency;
    priority?: number;
  } = {},
): SitemapEntry {
  return {
    url: new URL(createLocalePath(locales[0], route), baseUrl).toString(),
    lastModified: options.lastModified,
    changeFrequency: options.changeFrequency,
    priority: options.priority,
    alternates: [
      ...locales.map((locale) => ({
        locale,
        href: new URL(createLocalePath(locale, route), baseUrl).toString(),
      })),
      {
        locale: "x-default" as const,
        href: new URL(
          createLocalePath(defaultLocale, route),
          baseUrl,
        ).toString(),
      },
    ],
  };
}

export async function getSitemapEntries(id: SitemapId): Promise<SitemapEntry[]> {
  const baseUrl = getMetadataBase();

  if (id === "static") {
    return staticRoutes.map((route) =>
      buildEntry(baseUrl, route.path, {
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
      .map((item) =>
        buildEntry(baseUrl, `/projects/tag/${item.slug}`, {
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
      .map((item) =>
        buildEntry(baseUrl, `/projects/type/${item.kind}`, {
          changeFrequency: "weekly",
          priority: 0.5,
        }),
      );
  }

  if (id === "talent-skills") {
    const items = await getTalentSkillDirectory();
    return items
      .filter((item) => item.count >= MIN_TALENT_ITEMS_FOR_PAGE)
      .map((item) =>
        buildEntry(baseUrl, `/talents/skill/${item.slug}`, {
          changeFrequency: "weekly",
          priority: 0.5,
        }),
      );
  }

  if (id === "talent-roles") {
    const items = await getProfileCategoryDirectory();
    return items
      .filter((item) => item.count >= MIN_TALENT_ITEMS_FOR_PAGE)
      .map((item) =>
        buildEntry(baseUrl, `/talents/role/${item.slug}`, {
          changeFrequency: "weekly",
          priority: 0.5,
        }),
      );
  }

  const supabase = await createClient();

  if (id === "profiles") {
    const { data } = await supabase
      .from("profiles")
      .select("username, updated_at")
      .eq("moderation_status", "approved")
      .not("username", "is", null)
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_PAGE_SIZE);

    return (data || []).map((profile) =>
      buildEntry(baseUrl, `/u/${profile.username}`, {
        lastModified: new Date(profile.updated_at),
        changeFrequency: "weekly",
        priority: 0.7,
      }),
    );
  }

  if (id === "projects") {
    const { data } = await supabase
      .from("projects")
      .select("slug, updated_at")
      .eq("moderation_status", "approved")
      .eq("status", "published")
      .not("slug", "is", null)
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_PAGE_SIZE);

    return (data || []).map((project) =>
      buildEntry(baseUrl, `/projects/${project.slug}`, {
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

    return (data || []).map((article) =>
      buildEntry(baseUrl, `/articles/${article.slug}`, {
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

    return (data || []).map((poll) =>
      buildEntry(baseUrl, `/polls/${poll.slug}`, {
        lastModified: new Date(poll.updated_at),
        changeFrequency: "weekly",
        priority: 0.6,
      }),
    );
  }

  return [];
}
