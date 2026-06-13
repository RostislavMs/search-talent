import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import { getTechnologyBySlug } from "@/lib/db/marketing";
import { getInitialDiscoveryResults } from "@/lib/db/search";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { buildProjectsTagMetadata } from "@/lib/seo";
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

  const initial = await getInitialDiscoveryResults({
    scope: "projects",
    sort: "relevance",
    page: 1,
    perPage: 10,
    skillIds: [technology.id],
  });

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

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <DiscoveryPage
        mode="projects"
        lockedFilter={{ label: technology.name, skillId: technology.id }}
        hero={hero}
        initialUsers={initial?.users}
        initialProjects={initial?.projects}
        initialTotals={initial?.totals}
      />
    </main>
  );
}
