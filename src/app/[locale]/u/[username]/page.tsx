import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import ProfileVisitorViewBar from "@/components/profile-visitor-view-bar";
import PublicProfileShowcase from "@/components/public-profile-showcase";
import RelatedCreators from "@/components/related-creators";
import ViewBeacon from "@/components/view-beacon";
import { CreatorCardGridSkeleton } from "@/components/skeletons/card-skeletons";
import { getPublicProfilePageData } from "@/lib/db/public";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  isProfileHiddenFromVisitors,
  isProfileVisitorViewRequested,
  PROFILE_VISITOR_VIEW_PARAM,
  toProfileVisitorView,
} from "@/lib/profile-visitor-view";
import {
  buildAutoProfileSeoParagraph,
  buildPersonSchema,
  buildPersonSameAs,
  buildProfilePageSchema,
  buildBreadcrumbSchema,
  buildProfilePageMetadata,
  getMetadataBase,
  isProfileIndexable,
  safeJsonLd,
  toBcp47,
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
  const data = await getPublicProfilePageData(username, locale);
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
  // Thin-content (noindex) decision via the shared seo helper so this page and
  // the sitemap stay in lockstep on which profiles are indexable.
  const isThin =
    !data || !isProfileIndexable({ projectCount, bio: data.profile.bio });

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
  searchParams,
}: {
  params: Promise<{ locale: string; username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, username } = await getRouteParams(params);
  const query = await searchParams;
  const dictionary = getDictionary(locale);
  const [ownerData, viewer] = await Promise.all([
    getPublicProfilePageData(username, locale),
    getCurrentViewerRole(),
  ]);

  if (!ownerData) {
    notFound();
  }

  // "View as visitor": only the owner can ask for it; for anyone else the
  // parameter changes nothing, since they get the guest page anyway.
  const visitorView =
    ownerData.isOwner && isProfileVisitorViewRequested(query[PROFILE_VISITOR_VIEW_PARAM]);
  const data = visitorView ? toProfileVisitorView(ownerData) : ownerData;

  const siteUrl = getMetadataBase().toString().replace(/\/$/, "");
  const profileUrl = `${siteUrl}/${locale}/u/${username}`;

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
    inLanguage: toBcp47(locale),
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
      {visitorView ? (
        <ProfileVisitorViewBar
          dictionary={dictionary}
          username={data.profile.username || username}
          hiddenFromVisitors={isProfileHiddenFromVisitors(data)}
        />
      ) : (
        <ViewBeacon targetType="profile" targetId={data.profile.id} />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(profilePageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }}
      />
      <PublicProfileShowcase
        locale={locale}
        dictionary={dictionary}
        data={data}
        isAdmin={visitorView ? false : viewer.isAdmin}
      />
      <Suspense
        fallback={
          <section className="mx-auto mt-5 max-w-[90rem] px-4 pb-10 sm:mt-8 sm:px-6">
            <div className="rounded-2xl app-card p-4 sm:rounded-hero sm:p-6">
              <CreatorCardGridSkeleton count={3} />
            </div>
          </section>
        }
      >
        <RelatedCreators
          profileId={data.profile.id}
          skillIds={data.technologies.map((technology) => technology.id)}
          categoryId={data.profile.category_id}
          dictionary={dictionary}
        />
      </Suspense>
    </>
  );
}
