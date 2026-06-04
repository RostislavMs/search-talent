import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import { getProfileCategoryBySlug } from "@/lib/db/marketing";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { buildTalentCategoryMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

const DiscoveryPage = nextDynamic(() => import("@/components/discovery-page"), {
  loading: () => <DiscoveryPageSkeleton mode="creators" heroVariant="minimal" />,
});

// Rendered per request — see the note in /projects/tag/[tag]; the on-demand
// ISR path 500s in production for these facet pages.
export const dynamic = "force-dynamic";

const MIN_TALENTS_FOR_ROLE_PAGE = 3;

async function getRouteParams(
  params: Promise<{ locale: string; role: string }>,
) {
  const { locale, role } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return {
    locale: locale as Locale,
    role,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; role: string }>;
}): Promise<Metadata> {
  const { locale, role } = await getRouteParams(params);
  const category = await getProfileCategoryBySlug(role);

  if (!category) {
    notFound();
  }

  return buildTalentCategoryMetadata({
    locale,
    pathname: `/talents/role/${role}`,
    role: category.name,
    count: category.count,
    noindex: category.count < MIN_TALENTS_FOR_ROLE_PAGE,
  });
}

export default async function TalentsByRolePage({
  params,
}: {
  params: Promise<{ locale: string; role: string }>;
}) {
  const { locale, role } = await getRouteParams(params);
  const category = await getProfileCategoryBySlug(role);

  if (!category) {
    notFound();
  }

  const hero = {
    eyebrow: locale === "uk" ? "Напрямок" : "Direction",
    title:
      locale === "uk"
        ? `${category.name} — фахівці`
        : `${category.name} talents`,
    subtitle:
      locale === "uk"
        ? `Публічні профілі та портфоліо в напрямку «${category.name}». Фільтруйте за навичками, локацією та досвідом.`
        : `Public profiles and portfolios in the ${category.name} direction. Filter by skills, location, and experience.`,
  };

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <DiscoveryPage
        mode="creators"
        lockedFilter={{ label: category.name, categoryId: category.id }}
        hero={hero}
      />
    </main>
  );
}
