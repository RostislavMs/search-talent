import type { Metadata } from "next";
import dynamic from "next/dynamic";
import BrowseFacets from "@/components/browse-facets";
import JsonLd from "@/components/json-ld";
import ScrollToTopButton from "@/components/scroll-to-top-button";
import SeoFaqSection from "@/components/seo-faq-section";
import DiscoveryPageSkeleton from "@/components/skeletons/discovery-page-skeleton";
import {
  getProfileCategoryDirectory,
  getTalentSkillDirectory,
} from "@/lib/db/marketing";
import { getInitialDiscoveryResults } from "@/lib/db/search";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";
import { buildItemListSchema, buildMetadata, getSiteUrl, toBcp47 } from "@/lib/seo";
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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const locale = (await getLocaleValue(params)) as Locale;
  const marketing = getMarketingContent(locale);
  const dictionary = getDictionary(locale);

  // The WebSite JSON-LD `SearchAction` sends visitors here as
  // `/talents?q={term}` (Google's sitelinks searchbox). Seed the SSR results
  // and the search box with that term so the page actually renders matches;
  // the canonical stays `/talents` (see buildMetadata) so query variants are
  // consolidated rather than indexed separately.
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() || "";

  const [roles, skills, initial] = await Promise.all([
    getProfileCategoryDirectory(),
    getTalentSkillDirectory(),
    getInitialDiscoveryResults({
      scope: "creators",
      sort: "relevance",
      page: 1,
      perPage: 12,
      q: query || undefined,
    }),
  ]);

  const visibleRoles = roles
    .filter((role) => role.count >= MIN_TALENTS_PER_FACET)
    .sort((left, right) => right.count - left.count);
  const roleItems = visibleRoles.slice(0, ROLE_LIMIT).map((role) => ({
    label: role.name,
    href: `/talents/role/${role.slug}`,
    count: role.count,
  }));

  const visibleSkills = skills.filter(
    (skill) => skill.count >= MIN_TALENTS_PER_FACET,
  );
  const skillItems = visibleSkills.slice(0, SKILL_LIMIT).map((skill) => ({
    label: skill.name,
    href: `/talents/skill/${skill.slug}`,
    count: skill.count,
  }));

  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const talentListItems = (initial?.users ?? [])
    .filter((user) => user.username)
    .map((user) => ({
      url: `${siteUrl}/${locale}/u/${user.username}`,
      name: user.name || user.username,
    }));

  return (
    <main className="mx-auto max-w-[90rem] px-0 py-6 sm:px-6 sm:py-10">
      {talentListItems.length > 0 && (
        <JsonLd
          data={buildItemListSchema({
            url: `${siteUrl}/${locale}/talents`,
            name: locale === "uk" ? "Фахівці та портфоліо" : "Talents & portfolios",
            inLanguage: toBcp47(locale),
            items: talentListItems,
          })}
        />
      )}
      <DiscoveryPage
        mode="creators"
        initialQuery={query || undefined}
        initialUsers={initial?.users}
        initialProjects={initial?.projects}
        initialTotals={initial?.totals}
      />

      <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-8">
        <BrowseFacets
          title={locale === "uk" ? "Перегляд за напрямком" : "Browse by direction"}
          description={
            locale === "uk"
              ? "Профілі фахівців за основним напрямком роботи."
              : "Talent profiles grouped by their main direction."
          }
          items={roleItems}
          viewAllHref={
            visibleRoles.length > ROLE_LIMIT ? "/talents/role" : undefined
          }
          viewAllLabel={locale === "uk" ? "Усі напрямки" : "All directions"}
        />
        <BrowseFacets
          title={marketing.talents.popularTechnologiesTitle}
          description={marketing.talents.popularTechnologiesDescription}
          items={skillItems}
          viewAllHref={
            visibleSkills.length > SKILL_LIMIT ? "/talents/skill" : undefined
          }
          viewAllLabel={locale === "uk" ? "Усі навички" : "All skills"}
        />
        <SeoFaqSection title={marketing.talents.faqTitle} items={marketing.talents.faq} />
      </div>
      <ScrollToTopButton label={dictionary.common.scrollToTop} />
    </main>
  );
}
