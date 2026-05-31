import type { Metadata } from "next";
import dynamic from "next/dynamic";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import {
  getTechnologyBySlug,
  getTechnologyDirectory,
} from "@/lib/db/marketing";
import { locales, isLocale, type Locale } from "@/lib/i18n/config";
import { buildProjectsTagMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

const DiscoveryPage = dynamic(() => import("@/components/discovery-page"), {
  loading: () => <DiscoveryPageSkeleton mode="projects" />,
});

export const revalidate = 21600;

const MIN_PROJECTS_FOR_TAG_PAGE = 5;

export async function generateStaticParams() {
  const items = await getTechnologyDirectory(200);
  const eligible = items.filter(
    (item) => item.count >= MIN_PROJECTS_FOR_TAG_PAGE,
  );

  return locales.flatMap((locale) =>
    eligible.map((item) => ({ locale, tag: item.slug })),
  );
}

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
      />
    </main>
  );
}
