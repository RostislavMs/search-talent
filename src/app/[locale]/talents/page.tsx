import type { Metadata } from "next";
import dynamic from "next/dynamic";
import BrowseFacets from "@/components/browse-facets";
import SeoFaqSection from "@/components/seo-faq-section";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import {
  getProfileCategoryDirectory,
  getTalentSkillDirectory,
} from "@/lib/db/marketing";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";
import { buildMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";

const DiscoveryPage = dynamic(() => import("@/components/discovery-page"), {
  loading: () => <DiscoveryPageSkeleton mode="creators" />,
});

// Navigation display threshold — show any facet with at least one talent.
// This is intentionally separate from each landing page's indexability
// threshold (which keeps thin facet pages out of Google / the sitemap).
const MIN_TALENTS_PER_FACET = 1;
const ROLE_LIMIT = 16;
const SKILL_LIMIT = 24;

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
    pathname: "/talents",
    title: dictionary.metadata.talents.title,
    description: dictionary.metadata.talents.description,
  });
}

export default async function LocalizedTalentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await getLocaleValue(params)) as Locale;
  const marketing = getMarketingContent(locale);

  const [roles, skills] = await Promise.all([
    getProfileCategoryDirectory(),
    getTalentSkillDirectory(),
  ]);

  const roleItems = roles
    .filter((role) => role.count >= MIN_TALENTS_PER_FACET)
    .sort((left, right) => right.count - left.count)
    .slice(0, ROLE_LIMIT)
    .map((role) => ({
      label: role.name,
      href: `/talents/role/${role.slug}`,
      count: role.count,
    }));

  const skillItems = skills
    .filter((skill) => skill.count >= MIN_TALENTS_PER_FACET)
    .slice(0, SKILL_LIMIT)
    .map((skill) => ({
      label: skill.name,
      href: `/talents/skill/${skill.slug}`,
      count: skill.count,
    }));

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 sm:py-10">
      <DiscoveryPage mode="creators" />

      <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-8">
        <BrowseFacets
          title={locale === "uk" ? "Перегляд за напрямком" : "Browse by direction"}
          description={
            locale === "uk"
              ? "Профілі фахівців за основним напрямком роботи."
              : "Talent profiles grouped by their main direction."
          }
          items={roleItems}
        />
        <BrowseFacets
          title={marketing.talents.popularTechnologiesTitle}
          description={marketing.talents.popularTechnologiesDescription}
          items={skillItems}
        />
        <SeoFaqSection title={marketing.talents.faqTitle} items={marketing.talents.faq} />
      </div>
    </main>
  );
}
