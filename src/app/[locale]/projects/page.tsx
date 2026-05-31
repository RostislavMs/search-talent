import type { Metadata } from "next";
import dynamic from "next/dynamic";
import BrowseFacets from "@/components/browse-facets";
import SeoFaqSection from "@/components/seo-faq-section";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import {
  getProjectKindDirectory,
  getTechnologyDirectory,
} from "@/lib/db/marketing";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";
import {
  getProjectKindLabel,
  normalizeProjectKind,
} from "@/lib/projects";
import { buildMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

const DiscoveryPage = dynamic(() => import("@/components/discovery-page"), {
  loading: () => <DiscoveryPageSkeleton mode="projects" />,
});

// Navigation display threshold — show any tag with at least one project.
// Separate from the /projects/tag landing page's indexability threshold,
// which keeps thin tag pages out of Google / the sitemap.
const MIN_PROJECTS_PER_TAG = 1;
const TAG_LIMIT = 24;

async function getLocaleValue(params: Promise<{ locale: string }>) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);

  return buildMetadata({
    locale,
    pathname: "/projects",
    title: dictionary.metadata.projects.title,
    description: dictionary.metadata.projects.description,
  });
}

export default async function LocalizedProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await getLocaleValue(params)) as Locale;
  const marketing = getMarketingContent(locale);
  const dictionary = getDictionary(locale);

  const [technologies, kindCounts] = await Promise.all([
    getTechnologyDirectory(200),
    getProjectKindDirectory(),
  ]);

  const techItems = technologies
    .filter((technology) => technology.count >= MIN_PROJECTS_PER_TAG)
    .slice(0, TAG_LIMIT)
    .map((technology) => ({
      label: technology.name,
      href: `/projects/tag/${technology.slug}`,
      count: technology.count,
    }));

  const typeItems = kindCounts
    .map((entry) => ({ kind: normalizeProjectKind(entry.kind), count: entry.count }))
    .filter((entry) => entry.kind && entry.count >= 1)
    .sort((left, right) => right.count - left.count)
    .map((entry) => ({
      label: getProjectKindLabel(entry.kind!, dictionary),
      href: `/projects/type/${entry.kind}`,
      count: entry.count,
    }));

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <DiscoveryPage mode="projects" />

      <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-8">
        <BrowseFacets
          title={locale === "uk" ? "Перегляд за типом" : "Browse by type"}
          description={
            locale === "uk"
              ? "Публічні проєкти за форматом роботи."
              : "Public projects grouped by their format."
          }
          items={typeItems}
        />
        <BrowseFacets
          title={locale === "uk" ? "Перегляд за технологією" : "Browse by technology"}
          description={
            locale === "uk"
              ? "Публічні проєкти, згруповані за стеком технологій."
              : "Public projects grouped by their technology stack."
          }
          items={techItems}
        />
        <SeoFaqSection title={marketing.projects.faqTitle} items={marketing.projects.faq} />
      </div>
    </main>
  );
}
