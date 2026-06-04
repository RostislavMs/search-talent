import type { Metadata } from "next";
import dynamic from "next/dynamic";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import { getProjectKindDirectory } from "@/lib/db/marketing";
import { locales, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  getProjectKindLabel,
  normalizeProjectKind,
  projectKinds,
  type ProjectKind,
} from "@/lib/projects";
import { buildMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

const DiscoveryPage = dynamic(() => import("@/components/discovery-page"), {
  loading: () => <DiscoveryPageSkeleton mode="projects" heroVariant="minimal" />,
});

export const revalidate = 21600;

const MIN_PROJECTS_FOR_TYPE_PAGE = 3;

export async function generateStaticParams() {
  return locales.flatMap((locale) =>
    projectKinds.map((kind) => ({ locale, type: kind })),
  );
}

async function getRouteParams(
  params: Promise<{ locale: string; type: string }>,
) {
  const { locale, type } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const kind = normalizeProjectKind(type);

  if (!kind) {
    notFound();
  }

  return {
    locale: locale as Locale,
    kind,
  };
}

async function getKindCount(kind: ProjectKind) {
  const directory = await getProjectKindDirectory();
  return directory.find((item) => item.kind === kind)?.count ?? 0;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}): Promise<Metadata> {
  const { locale, kind } = await getRouteParams(params);
  const dictionary = getDictionary(locale);
  const label = getProjectKindLabel(kind, dictionary);
  const count = await getKindCount(kind);

  const title =
    locale === "uk"
      ? `Проєкти типу «${label}» — портфоліо`
      : `${label} Projects & Portfolios`;
  const description =
    locale === "uk"
      ? `Публічні проєкти у форматі «${label}» на SearchTalent. Реальні роботи, технології та автори.`
      : `Public ${label.toLowerCase()} projects on SearchTalent. Real work, technologies, and creators.`;

  return buildMetadata({
    locale,
    pathname: `/projects/type/${kind}`,
    title,
    description,
    noindex: count < MIN_PROJECTS_FOR_TYPE_PAGE,
  });
}

export default async function ProjectsByTypePage({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}) {
  const { locale, kind } = await getRouteParams(params);
  const dictionary = getDictionary(locale);
  const label = getProjectKindLabel(kind, dictionary);

  const hero = {
    eyebrow: locale === "uk" ? "Тип проєкту" : "Project type",
    title:
      locale === "uk"
        ? `Проєкти типу «${label}»`
        : `${label} projects`,
    subtitle:
      locale === "uk"
        ? `Публічні проєкти у форматі «${label}». Фільтруйте за технологіями, статусом і рейтингом.`
        : `Public ${label.toLowerCase()} projects. Filter by technology, status, and rating.`,
  };

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <DiscoveryPage
        mode="projects"
        lockedFilter={{ label, kind }}
        hero={hero}
      />
    </main>
  );
}
