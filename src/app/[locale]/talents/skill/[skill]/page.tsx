import type { Metadata } from "next";
import nextDynamic from "next/dynamic";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import { getTalentSkillBySlug } from "@/lib/db/marketing";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { buildTechnologyTalentsMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

const DiscoveryPage = nextDynamic(() => import("@/components/discovery-page"), {
  loading: () => <DiscoveryPageSkeleton mode="creators" />,
});

// Rendered per request — see the note in /projects/tag/[tag]; the on-demand
// ISR path 500s in production for these facet pages.
export const dynamic = "force-dynamic";

const MIN_TALENTS_FOR_PAGE = 3;

async function getRouteParams(
  params: Promise<{ locale: string; skill: string }>,
) {
  const { locale, skill } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return {
    locale: locale as Locale,
    skill,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; skill: string }>;
}): Promise<Metadata> {
  const { locale, skill } = await getRouteParams(params);
  const technology = await getTalentSkillBySlug(skill);

  if (!technology) {
    notFound();
  }

  return buildTechnologyTalentsMetadata({
    locale,
    pathname: `/talents/skill/${skill}`,
    technology: technology.name,
    count: technology.count,
    noindex: technology.count < MIN_TALENTS_FOR_PAGE,
  });
}

export default async function TalentsBySkillPage({
  params,
}: {
  params: Promise<{ locale: string; skill: string }>;
}) {
  const { locale, skill } = await getRouteParams(params);
  const technology = await getTalentSkillBySlug(skill);

  if (!technology) {
    notFound();
  }

  const hero = {
    eyebrow: locale === "uk" ? "Навичка" : "Skill",
    title:
      locale === "uk"
        ? `Фахівці з ${technology.name}`
        : `${technology.name} specialists`,
    subtitle:
      locale === "uk"
        ? `Публічні профілі та портфоліо фахівців, які працюють з ${technology.name}. Фільтруйте за локацією, досвідом і напрямком.`
        : `Public profiles and portfolios of specialists working with ${technology.name}. Filter by location, experience, and direction.`,
  };

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <DiscoveryPage
        mode="creators"
        lockedFilter={{ label: technology.name, skillId: technology.id }}
        hero={hero}
      />
    </main>
  );
}
