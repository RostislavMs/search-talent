import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import JsonLd from "@/components/json-ld";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import { getTechnologyBySlug } from "@/lib/db/marketing";
import { getDiscoverySeed } from "@/lib/db/search";
import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  buildItemListSchema,
  buildProjectsTagMetadata,
  getSiteUrl,
  toBcp47,
} from "@/lib/seo";
import { notFound } from "next/navigation";

const DiscoveryPage = nextDynamic(() => import("@/components/discovery-page"), {
  loading: () => <DiscoveryPageSkeleton mode="projects" heroVariant="minimal" />,
});

// Rendered per request. These facet pages have no pre-built params (the long
// tail rarely meets the prebuild threshold), so they would otherwise fall on
// the on-demand ISR path, which 500s in production. force-dynamic puts them on
// the same proven per-request SSR path as the other dynamic content pages.
export const dynamic = "force-dynamic";

const MIN_PROJECTS_FOR_TAG_PAGE = 5;

async function getRouteParams(
  params: Promise<{ locale: string; tag: string }>,
) {
  const { locale, tag } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return {
    locale: locale as Locale,
    tag,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; tag: string }>;
}): Promise<Metadata> {
  const { locale, tag } = await getRouteParams(params);
  const technology = await getTechnologyBySlug(tag);

  if (!technology) {
    notFound();
  }

  return buildProjectsTagMetadata({
    locale,
    pathname: `/projects/tag/${tag}`,
    technology: technology.name,
    count: technology.count,
    noindex: technology.count < MIN_PROJECTS_FOR_TAG_PAGE,
  });
}

export default async function ProjectsByTagPage({
  params,
}: {
  params: Promise<{ locale: string; tag: string }>;
}) {
  const { locale, tag } = await getRouteParams(params);
  const technology = await getTechnologyBySlug(tag);

  if (!technology) {
    notFound();
  }

  const seed = await getDiscoverySeed({
    scope: "projects",
    page: 1,
    perPage: 12,
    skillIds: [technology.id],
  });
  const initial = seed.results;

  const hero = {
    eyebrow: locale === "uk" ? "Стек" : "Stack",
    title:
      locale === "uk"
        ? `IT-проєкти на ${technology.name}`
        : `${technology.name} IT projects`,
    subtitle:
      locale === "uk"
        ? `Публічні проєкти зі стеком ${technology.name}. Фільтруйте за статусом, типом і рейтингом.`
        : `Public projects built with ${technology.name}. Filter by status, type, and rating.`,
  };

  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const listItems = (initial?.projects ?? [])
    .filter((project) => project.slug)
    .map((project) => ({
      url: `${siteUrl}/${locale}/projects/${project.slug}`,
      name: project.title,
    }));

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-6 sm:px-6 sm:py-10">
      {listItems.length > 0 && (
        <JsonLd
          data={buildItemListSchema({
            url: `${siteUrl}/${locale}/projects/tag/${tag}`,
            name: hero.title,
            inLanguage: toBcp47(locale),
            items: listItems,
          })}
        />
      )}
      <DiscoveryPage
        mode="projects"
        lockedFilter={{ label: technology.name, skillId: technology.id }}
        hero={hero}
        initialSort={seed.sort}
        canPersonalize={seed.canPersonalize}
        initialUsers={initial?.users}
        initialProjects={initial?.projects}
        initialTotals={initial?.totals}
      />
    </main>
  );
}
