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
  "project-tags",
  "project-types",
  "talent-skills",
  "talent-roles",
] as const;

export type SitemapId = (typeof SITEMAP_IDS)[number];

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  alternates: Array<{ locale: Locale | "x-default"; href: string }>;
};

const SITEMAP_PAGE_SIZE = 5000;
const MIN_ITEMS_FOR_PROGRAMMATIC_PAGE = 5;
const MIN_TALENT_ITEMS_FOR_PAGE = 3;
const MIN_PROJECT_TYPE_ITEMS_FOR_PAGE = 3;

// Stable lastmod for static/legal/info pages — bump when their content
// actually changes (avoids signalling "updated" on every sitemap render).
const STATIC_LASTMOD = new Date("2026-06-10T00:00:00.000Z");

const staticRoutes = [
  "/",
  "/talents",
  "/projects",
  "/articles",
  "/about",
  "/rating-guide",
  "/faq",
  "/legal",
  "/terms",
  "/privacy",
  "/cookies",
];

function buildEntry(
  baseUrl: URL,
  route: string,
  lastModified?: Date,
): SitemapEntry {
  return {
    url: new URL(createLocalePath(locales[0], route), baseUrl).toString(),
    lastModified,
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
      buildEntry(baseUrl, route, STATIC_LASTMOD),
    );
  }

  if (id === "project-tags") {
    const items = await getTechnologyDirectory(200);
    return items
      .filter((item) => item.count >= MIN_ITEMS_FOR_PROGRAMMATIC_PAGE)
      .map((item) => buildEntry(baseUrl, `/projects/tag/${item.slug}`));
  }

  if (id === "project-types") {
    const items = await getProjectKindDirectory();
    return items
      .filter(
        (item) =>
          normalizeProjectKind(item.kind) !== null &&
          item.count >= MIN_PROJECT_TYPE_ITEMS_FOR_PAGE,
      )
      .map((item) => buildEntry(baseUrl, `/projects/type/${item.kind}`));
  }

  if (id === "talent-skills") {
    const items = await getTalentSkillDirectory();
    return items
      .filter((item) => item.count >= MIN_TALENT_ITEMS_FOR_PAGE)
      .map((item) => buildEntry(baseUrl, `/talents/skill/${item.slug}`));
  }

  if (id === "talent-roles") {
    const items = await getProfileCategoryDirectory();
    return items
      .filter((item) => item.count >= MIN_TALENT_ITEMS_FOR_PAGE)
      .map((item) => buildEntry(baseUrl, `/talents/role/${item.slug}`));
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
      buildEntry(
        baseUrl,
        `/u/${profile.username}`,
        new Date(profile.updated_at),
      ),
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
      buildEntry(
        baseUrl,
        `/projects/${project.slug}`,
        new Date(project.updated_at),
      ),
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
      buildEntry(
        baseUrl,
        `/articles/${article.slug}`,
        new Date(article.updated_at),
      ),
    );
  }

  return [];
}
