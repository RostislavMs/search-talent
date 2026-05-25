import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicProfileShowcase from "@/components/public-profile-showcase";
import { getPublicProfilePageData } from "@/lib/db/public";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  buildAutoProfileSeoParagraph,
  buildPersonSchema,
  buildPersonSameAs,
  buildProfilePageSchema,
  buildBreadcrumbSchema,
  buildProfilePageMetadata,
  getMetadataBase,
  safeJsonLd,
} from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getRouteParams(
  params: Promise<{ locale: string; username: string }>,
) {
  const { locale, username } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return {
    locale: locale as Locale,
    username,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}): Promise<Metadata> {
  const { locale, username } = await getRouteParams(params);
  const data = await getPublicProfilePageData(username);
  const displayName = data?.profile.name || data?.profile.username || null;
  const role = data?.profile.headline || data?.profile.categoryName || null;
  const projectCount = data?.projects.length ?? 0;
  const fallbackParagraph = data
    ? buildAutoProfileSeoParagraph({
        locale,
        projectCount,
        topTechnologies: data.technologies.map((technology) => technology.name),
        experienceYears: data.profile.experience_years,
        workFormats: data.profile.work_formats,
      })
    : null;
  const hasBio = Boolean(data?.profile.bio?.trim());
  const isThin = !data || (projectCount === 0 && !hasBio);

  return buildProfilePageMetadata({
    locale,
    pathname: `/u/${username}`,
    name: displayName,
    role,
    country: data?.profile.countryName || null,
    projectCount,
    bio: data?.profile.bio || null,
    fallbackParagraph,
    noindex: isThin,
  });
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await getRouteParams(params);
  const dictionary = getDictionary(locale);
  const [data, viewer] = await Promise.all([
    getPublicProfilePageData(username),
    getCurrentViewerRole(),
  ]);

  if (!data) {
    notFound();
  }

  const siteUrl = getMetadataBase().toString().replace(/\/$/, "");
  const profileUrl = `${siteUrl}/${locale}/u/${username}`;
  const generatedSummary = !data.profile.bio?.trim()
    ? buildAutoProfileSeoParagraph({
        locale,
        projectCount: data.projects.length,
        topTechnologies: data.technologies.map((technology) => technology.name),
        experienceYears: data.profile.experience_years,
        workFormats: data.profile.work_formats,
      })
    : null;

  const currentPosition =
    data.workExperience.find((item) => item.is_current) ||
    data.workExperience[0] ||
    null;
  const mostRecentEducation = data.education[0] || null;

  const personSchema = buildPersonSchema({
    name: data.profile.name,
    username: data.profile.username,
    headline: data.profile.headline,
    avatarUrl: data.profile.avatar_url,
    skills: data.technologies.map((technology) => technology.name),
    url: profileUrl,
    sameAs: buildPersonSameAs({
      website: data.profile.website,
      github: data.profile.github,
      twitter: data.profile.twitter,
      linkedin: data.profile.linkedin,
    }),
    languages: data.languages.map((language) => language.name),
    currentPosition: currentPosition
      ? {
          position: currentPosition.position,
          company: currentPosition.company_name,
        }
      : null,
    mostRecentEducation: mostRecentEducation
      ? {
          institution: mostRecentEducation.institution,
          degree: mostRecentEducation.degree,
        }
      : null,
  });

  const profilePageSchema = buildProfilePageSchema({
    url: profileUrl,
    person: personSchema,
    dateCreated: null,
    dateModified: null,
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: dictionary.nav.home, url: `${siteUrl}/${locale}` },
    { name: dictionary.common.creators, url: `${siteUrl}/${locale}/talents` },
    {
      name: data.profile.name || data.profile.username || dictionary.common.profile,
      url: profileUrl,
    },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(profilePageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
      />
      {generatedSummary ? (
        <section className="mx-auto mb-5 max-w-[90rem] px-4 sm:mb-6 sm:px-6">
          <div className="rounded-[1.75rem] app-card p-4 sm:p-5">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
              {locale === "uk" ? "Короткий огляд профілю" : "Profile overview"}
            </h2>
            <p className="mt-3 text-sm leading-7 app-muted">{generatedSummary}</p>
          </div>
        </section>
      ) : null}
      <PublicProfileShowcase
        locale={locale}
        dictionary={dictionary}
        data={data}
        isAdmin={viewer.isAdmin}
      />
    </>
  );
}
