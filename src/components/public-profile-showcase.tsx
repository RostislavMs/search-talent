import type { CSSProperties, ReactNode } from "react";
import dynamic from "next/dynamic";
import AdminContentQuickActions from "@/components/admin-content-quick-actions";
import BookmarkButton from "@/components/bookmark-button";
import ExpandableProfileBio from "@/components/expandable-profile-bio";
import FollowButton from "@/components/follow-button";
import ProfileAiSummaryPublic from "@/components/profile-ai-summary-public";
import ProfileVoteButtons from "@/components/profile-vote-buttons";

const ProfilePdfExport = dynamic(
  () => import("@/components/profile-pdf-export"),
);
import ProjectCard from "@/components/project-card";
import VerifiedBadge from "@/components/verified-badge";
import { ButtonLink } from "@/components/ui/Button";
import HorizontalCarousel from "@/components/ui/horizontal-carousel";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import type { PublicProfilePageData } from "@/lib/db/public";
import {
  getProfileFontStack,
  getProfileTextScale,
  type ProfilePresentation,
  type ProfileSectionId,
  type ProfileSectionSize,
} from "@/lib/profile-presentation";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;
  const parsed = Number.parseInt(value, 16);
  const r = Number.isNaN(parsed) ? 255 : (parsed >> 16) & 255;
  const g = Number.isNaN(parsed) ? 255 : (parsed >> 8) & 255;
  const b = Number.isNaN(parsed) ? 255 : parsed & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getExperienceLabel(value: string | null, locale: string) {
  if (!value) {
    return null;
  }

  const labels =
    locale === "uk"
      ? {
          no_experience: "Без досвіду",
          months_3: "3 міс",
          months_6: "6 міс",
          year_1: "1 рік",
          years_2: "2 роки",
          years_3: "3 роки",
          years_4: "4 роки",
          years_5: "5 років",
          years_6: "6 років",
          years_7: "7 років",
          years_8: "8 років",
          years_9: "9 років",
          years_10: "10 років",
          more_than_10_years: "10+ років",
        }
      : {
          no_experience: "No experience",
          months_3: "3 months",
          months_6: "6 months",
          year_1: "1 year",
          years_2: "2 years",
          years_3: "3 years",
          years_4: "4 years",
          years_5: "5 years",
          years_6: "6 years",
          years_7: "7 years",
          years_8: "8 years",
          years_9: "9 years",
          years_10: "10 years",
          more_than_10_years: "10+ years",
        };

  return labels[value as keyof typeof labels] || value;
}

function getEmploymentLabel(value: string, dictionary: Dictionary) {
  switch (value) {
    case "full_time":
      return dictionary.forms.employmentTypeFullTime;
    case "part_time":
      return dictionary.forms.employmentTypePartTime;
    case "contract":
      return dictionary.forms.employmentTypeContract;
    case "freelance":
      return dictionary.forms.employmentTypeFreelance;
    case "internship":
      return dictionary.forms.employmentTypeInternship;
    default:
      return value;
  }
}

function getWorkFormatLabel(value: string, dictionary: Dictionary) {
  switch (value) {
    case "remote":
      return dictionary.forms.workFormatRemote;
    case "hybrid":
      return dictionary.forms.workFormatHybrid;
    case "office":
      return dictionary.forms.workFormatOffice;
    default:
      return value;
  }
}

function getLanguageLevelLabel(value: string | null, dictionary: Dictionary) {
  switch (value) {
    case "beginner":
      return dictionary.forms.languageLevelBeginner;
    case "elementary":
      return dictionary.forms.languageLevelElementary;
    case "intermediate":
      return dictionary.forms.languageLevelIntermediate;
    case "upper_intermediate":
      return dictionary.forms.languageLevelUpperIntermediate;
    case "advanced":
      return dictionary.forms.languageLevelAdvanced;
    case "native":
      return dictionary.forms.languageLevelNative;
    default:
      return value;
  }
}

function getPreferredContactMethodLabel(value: string | null, dictionary: Dictionary) {
  switch (value) {
    case "email":
      return dictionary.creatorProfile.contactMethodEmail;
    case "telegram":
      return dictionary.creatorProfile.contactMethodTelegram;
    case "phone":
      return dictionary.creatorProfile.contactMethodPhone;
    case "linkedin":
      return dictionary.creatorProfile.contactMethodLinkedin;
    case "website":
      return dictionary.creatorProfile.contactMethodWebsite;
    default:
      return value;
  }
}

function getSectionSpan(size: ProfileSectionSize) {
  switch (size) {
    case "compact":
      return "lg:col-span-4";
    case "wide":
      return "lg:col-span-8";
    case "full":
      return "lg:col-span-12";
    case "regular":
    default:
      return "lg:col-span-6";
  }
}

function SectionCard({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor: string;
  children: ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl app-card p-4 sm:rounded-[1.9rem] sm:p-6"
      style={{
        backgroundImage: `radial-gradient(circle at top right, ${withAlpha(
          accentColor,
          0.18,
        )} 0%, transparent 45%)`,
      }}
    >
      <div className="mb-5 h-1.5 w-14 rounded-full" style={{ backgroundColor: accentColor }} />
      <h2 className="text-xl font-semibold text-[color:var(--foreground)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function getThemeStyle(presentation: ProfilePresentation) {
  return {
    "--background": presentation.surfaceColor,
    "--foreground": presentation.textColor,
    "--surface":
      presentation.cardStyle === "glass"
        ? withAlpha("#ffffff", 0.1)
        : presentation.panelColor,
    "--surface-muted":
      presentation.cardStyle === "glass"
        ? withAlpha("#ffffff", 0.07)
        : withAlpha(presentation.panelColor, 0.78),
    "--border":
      presentation.cardStyle === "outline"
        ? withAlpha(presentation.accentColor, 0.8)
        : withAlpha(presentation.textColor, 0.12),
    "--muted-foreground": presentation.mutedColor,
    "--soft-foreground": withAlpha(presentation.mutedColor, 0.84),
    "--shadow": `0 28px 90px ${withAlpha("#020617", 0.26)}`,
  } as CSSProperties & Record<`--${string}`, string>;
}

export default function PublicProfileShowcase({
  locale,
  dictionary,
  data,
  isAdmin = false,
}: {
  locale: string;
  dictionary: Dictionary;
  data: PublicProfilePageData;
  isAdmin?: boolean;
}) {
  const {
    profile,
    technologies,
    languages,
    education,
    certificates,
    qas,
    workExperience,
    projects,
    articles,
    voteSummary,
    isAuthenticated,
    isOwner,
    isBookmarked,
    isFollowing,
  } = data;
  const presentation = profile.presentation;
  const typeScale = getProfileTextScale(presentation.textScale);
  const displayName = profile.name || profile.username || dictionary.common.creator;
  const sectionMap = new Map<ProfileSectionId, { title: string; content: ReactNode; visible: boolean }>([
    ["about", { title: dictionary.creatorProfile.about, visible: profile.visibility.about && Boolean(profile.bio || profile.headline), content: <div className="space-y-4">{profile.headline && <div className="rounded-[1.25rem] app-panel p-4"><p className="text-sm font-medium text-[color:var(--foreground)]">{dictionary.creatorProfile.positionLabel}</p><p className="mt-2 leading-7 app-muted">{profile.headline}</p></div>}{profile.bio && <div style={{ fontSize: `${typeScale.body}rem` }}><ExpandableProfileBio content={profile.bio} locale={locale} accentColor={presentation.accentColor} /></div>}</div> }],
    ["professionalDetails", { title: dictionary.creatorProfile.professionalDetails, visible: profile.visibility.professionalDetails && Boolean(profile.experience_level || profile.salary_expectations || (profile.employment_types?.length || 0) > 0 || (profile.work_formats?.length || 0) > 0 || profile.additional_info), content: <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{profile.experience_level && <div className="rounded-[1.25rem] app-panel p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] app-soft">{dictionary.creatorProfile.totalExperienceYears}</p><p className="mt-2 text-sm text-[color:var(--foreground)]">{getExperienceLabel(profile.experience_level, locale)}</p></div>}{profile.salary_expectations && <div className="rounded-[1.25rem] app-panel p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] app-soft">{dictionary.creatorProfile.salaryExpectations}</p><p className="mt-2 text-sm text-[color:var(--foreground)]">{profile.salary_expectations}{profile.salary_currency ? ` ${profile.salary_currency.toUpperCase()}` : ""}</p></div>}</div>{(profile.employment_types?.length || 0) > 0 && <div><p className="text-sm font-medium text-[color:var(--foreground)]">{dictionary.creatorProfile.employmentTypes}</p><div className="mt-2 flex flex-wrap gap-2">{(profile.employment_types || []).map((item) => <span key={item} className="rounded-full app-panel px-3 py-1 text-sm app-muted">{getEmploymentLabel(item, dictionary)}</span>)}</div></div>}{(profile.work_formats?.length || 0) > 0 && <div><p className="text-sm font-medium text-[color:var(--foreground)]">{dictionary.creatorProfile.workFormats}</p><div className="mt-2 flex flex-wrap gap-2">{(profile.work_formats || []).map((item) => <span key={item} className="rounded-full app-panel px-3 py-1 text-sm app-muted">{getWorkFormatLabel(item, dictionary)}</span>)}</div></div>}{profile.additional_info && <p className="text-sm leading-8 app-muted" style={{ fontSize: `${typeScale.body}rem` }}>{profile.additional_info}</p>}</div> }],
    ["workExperience", { title: dictionary.creatorProfile.workExperience, visible: profile.visibility.workExperience && workExperience.length > 0, content: <div className="space-y-4">{workExperience.map((item) => <article key={item.id} className="rounded-[1.25rem] app-panel p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[color:var(--foreground)]">{item.position || "—"}</h3><p className="mt-1 text-sm app-muted">{item.company_name || "—"}</p></div><span className="text-sm app-soft">{item.started_year || "—"} - {item.is_current ? dictionary.creatorProfile.present : item.ended_year || "—"}</span></div>{item.responsibilities && <p className="mt-3 text-sm leading-7 app-muted">{item.responsibilities}</p>}</article>)}</div> }],
    ["skills", { title: dictionary.creatorProfile.skills, visible: profile.visibility.skills && technologies.length > 0, content: <div className="flex flex-wrap gap-2">{technologies.map((technology) => <span key={technology.id} className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]">{technology.name}</span>)}</div> }],
    ["languages", { title: dictionary.creatorProfile.languages, visible: profile.visibility.languages && languages.length > 0, content: <div className="grid gap-3 md:grid-cols-2">{languages.map((item) => <div key={item.id} className="rounded-[1.25rem] app-panel p-4"><p className="font-medium text-[color:var(--foreground)]">{item.name}</p><p className="mt-1 text-sm app-muted">{getLanguageLevelLabel(item.level, dictionary)}</p></div>)}</div> }],
    ["education", { title: dictionary.creatorProfile.education, visible: profile.visibility.education && education.length > 0, content: <div className="space-y-4">{education.map((item) => <article key={item.id} className="rounded-[1.25rem] app-panel p-4"><h3 className="font-semibold text-[color:var(--foreground)]">{item.institution || "—"}</h3><p className="mt-1 text-sm app-muted">{[item.degree, item.field_of_study].filter(Boolean).join(" • ")}</p>{(item.started_on || item.completed_on) && <p className="mt-1 text-sm app-soft">{[item.started_on, item.completed_on].filter(Boolean).join(" - ")}</p>}{item.description && <p className="mt-3 text-sm leading-7 app-muted">{item.description}</p>}</article>)}</div> }],
    ["certificates", { title: dictionary.creatorProfile.certificates, visible: profile.visibility.certificates && certificates.length > 0, content: <div className="space-y-4">{certificates.map((item) => <article key={item.id} className="rounded-[1.25rem] app-panel p-4"><h3 className="font-semibold text-[color:var(--foreground)]">{item.title || "—"}</h3><p className="mt-1 text-sm app-muted">{[item.issuer, item.issued_on].filter(Boolean).join(" • ")}</p><div className="mt-3 flex flex-wrap gap-2">{item.credential_url && <a href={item.credential_url} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">{dictionary.creatorProfile.openCertificateLink}</a>}{item.file_url && <a href={item.file_url} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">{item.file_name || dictionary.creatorProfile.openCertificateFile}</a>}</div></article>)}</div> }],
    ["qa", { title: dictionary.creatorProfile.qa, visible: profile.visibility.qa && qas.length > 0, content: <div className="space-y-4">{qas.map((item) => <article key={item.id} className="rounded-[1.25rem] app-panel p-4"><h3 className="font-semibold text-[color:var(--foreground)]">{item.question || "—"}</h3><p className="mt-3 text-sm leading-7 app-muted">{item.answer || "—"}</p></article>)}</div> }],
    ["contacts", { title: dictionary.creatorProfile.contacts, visible: profile.visibility.links && Boolean(profile.contact_email || profile.telegram_username || profile.phone || profile.website || profile.github || profile.twitter || profile.linkedin), content: <div className="space-y-6"><div className="space-y-3 text-sm">{profile.contact_email && <a href={`mailto:${profile.contact_email}`} className="block text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4">{dictionary.creatorProfile.contactEmail}: {profile.contact_email}</a>}{profile.telegram_username && <a href={`https://t.me/${profile.telegram_username.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="block text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4">{dictionary.creatorProfile.telegram}: @{profile.telegram_username.replace(/^@/, "")}</a>}{profile.phone && <a href={`tel:${profile.phone}`} className="block text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4">{dictionary.creatorProfile.phone}: {profile.phone}</a>}{profile.preferred_contact_method && <p className="app-muted">{dictionary.creatorProfile.preferredContactMethod}: {getPreferredContactMethodLabel(profile.preferred_contact_method, dictionary)}</p>}</div><div><p className="text-sm font-medium text-[color:var(--foreground)]">{dictionary.creatorProfile.links}</p><div className="mt-3 flex flex-wrap gap-2">{profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">Website</a>}{profile.github && <a href={profile.github} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">GitHub</a>}{profile.twitter && <a href={profile.twitter} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">X / Twitter</a>}{profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">LinkedIn</a>}</div></div></div> }],
    [
      "projects",
      {
        title: dictionary.creatorProfile.projects,
        visible: projects.length > 0,
        content: (
          <ProfileItemsBlock
            description={dictionary.creatorProfile.publishedWork}
            viewAllLabel={dictionary.creatorProfile.viewAllProjects}
            viewAllHref={
              profile.username ? `/u/${profile.username}/projects` : null
            }
            totalCount={projects.length}
            carouselPrev={dictionary.creatorProfile.carouselPrev}
            carouselNext={dictionary.creatorProfile.carouselNext}
          >
            {projects.slice(0, 10).map((project) => (
              <ProjectCard
                key={project.id}
                dictionary={dictionary}
                project={{
                  ...project,
                  slug: project.slug || "",
                  ownerName: profile.name,
                  ownerUsername: profile.username,
                }}
              />
            ))}
          </ProfileItemsBlock>
        ),
      },
    ],
    [
      "articles",
      {
        title: dictionary.creatorProfile.articles,
        visible: articles.length > 0,
        content: (
          <ProfileItemsBlock
            description={dictionary.creatorProfile.publishedArticles}
            viewAllLabel={dictionary.creatorProfile.viewAllArticles}
            viewAllHref={
              profile.username ? `/u/${profile.username}/articles` : null
            }
            totalCount={articles.length}
            carouselPrev={dictionary.creatorProfile.carouselPrev}
            carouselNext={dictionary.creatorProfile.carouselNext}
          >
            {articles.slice(0, 10).map((item) => (
              <ProfileArticleCard
                key={item.id}
                article={item}
                locale={locale}
              />
            ))}
          </ProfileItemsBlock>
        ),
      },
    ],
  ]);
  const visibleSections = presentation.sectionOrder
    .map((sectionId) => {
      const section = sectionMap.get(sectionId);
      return section && section.visible ? { id: sectionId, ...section } : null;
    })
    .filter(Boolean) as Array<{ id: ProfileSectionId; title: string; content: ReactNode }>;

  return (
    <main className="mx-auto max-w-[88rem] px-3 py-4 sm:px-6 sm:py-8">
      <div
        className="relative overflow-hidden rounded-[2.5rem] border"
        style={{
          ...getThemeStyle(presentation),
          background: `linear-gradient(135deg, ${presentation.surfaceColor} 0%, ${presentation.panelColor} 58%, ${presentation.accentColor} 100%)`,
          color: presentation.textColor,
          fontFamily: getProfileFontStack(presentation.fontPreset),
        }}
      >
        <div className="relative p-4 sm:p-6 lg:p-8">
          <section className="relative overflow-hidden rounded-2xl app-card p-4 sm:rounded-[2rem] sm:p-6 lg:p-10">
            {presentation.backgroundUrl && presentation.backgroundMode === "image" && (
              <div className="absolute inset-0 -z-0">
                <OptimizedImage
                  src={presentation.backgroundUrl}
                  alt={displayName}
                  fill
                  sizePreset="banner"
                  className="object-cover"
                />
              </div>
            )}
            {presentation.backgroundUrl && presentation.backgroundMode === "video" && (
              <div className="absolute inset-0 -z-0">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                >
                  <source src={presentation.backgroundUrl} />
                </video>
              </div>
            )}
            {presentation.backgroundUrl && (
              <div
                className="absolute inset-0 -z-0"
                style={{
                  background: `linear-gradient(135deg, ${withAlpha(presentation.surfaceColor, Math.min(0.95, 0.45 + presentation.overlayStrength / 100))} 0%, ${withAlpha(presentation.panelColor, Math.min(0.92, 0.34 + presentation.overlayStrength / 120))} 55%, ${withAlpha(presentation.accentColor, 0.42)} 100%)`,
                }}
              />
            )}
            <div className="relative grid gap-6 sm:gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <div className={presentation.heroAlignment === "center" ? "text-center" : "text-left"}>
                <div className={`flex flex-wrap items-center gap-3 ${presentation.heroAlignment === "center" ? "justify-center" : ""}`}>
                  <ButtonLink href="/talents" variant="ghost" size="sm">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="mr-1 h-3.5 w-3.5" aria-hidden="true"><path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
                    {dictionary.creatorProfile.backToSearch}
                  </ButtonLink>
                  {isOwner && <ButtonLink href="/profile/edit" size="sm">{dictionary.creatorProfile.editProfile}</ButtonLink>}
                  {!isOwner && isAdmin && (
                    <AdminContentQuickActions
                      targetType="profile"
                      targetId={profile.id}
                      currentStatus={profile.moderation_status}
                      locale={locale}
                      redirectAfterDelete="/talents"
                    />
                  )}
                  <ProfilePdfExport data={data} />
                </div>

                <div className={`mt-5 flex gap-4 sm:mt-8 sm:gap-5 ${presentation.heroAlignment === "center" ? "flex-col items-center" : "flex-col items-start sm:flex-row"}`}>
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl app-panel text-3xl font-semibold text-[color:var(--foreground)] sm:h-28 sm:w-28 sm:rounded-[2rem] sm:text-4xl">
                    {profile.avatar_url ? <OptimizedImage src={profile.avatar_url} alt={displayName} fill sizes="(max-width: 640px) 80px, 112px" className="object-cover" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] sm:text-sm" style={{ color: presentation.mutedColor }}>{profile.categoryName || dictionary.common.creator}</p>
                    <h1 className="mt-2 font-semibold tracking-tight sm:mt-3" style={{ fontSize: `clamp(1.5rem, 5vw, ${3.2 * typeScale.heading}rem)`, lineHeight: 1.05 }}>{displayName}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-3">
                      <p className="text-sm app-muted sm:text-base">@{profile.username}</p>
                      <VerifiedBadge verified={profile.email_verified} />
                    </div>
                    {profile.headline && <p className="mt-3 max-w-3xl text-sm leading-7 app-muted sm:mt-5 sm:text-base sm:leading-8" style={{ fontSize: undefined }}>{profile.headline}</p>}
                    {profile.username ? (
                      <ProfileAiSummaryPublic
                        username={profile.username}
                        isAuthenticated={isAuthenticated}
                      />
                    ) : null}
                    <div className={`mt-4 flex flex-wrap gap-2 sm:mt-6 ${presentation.heroAlignment === "center" ? "justify-center" : ""}`}>
                      {(profile.city || profile.countryName) && <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">{[profile.city, profile.countryName].filter(Boolean).join(", ")}</span>}
                      {profile.experience_level && <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">{getExperienceLabel(profile.experience_level, locale)}</span>}
                      {isOwner && <span className="rounded-full app-panel px-3 py-1 text-sm app-muted">{dictionary.creatorProfile.ownerView}</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 xl:self-end">
                <ProfileVoteButtons profileId={profile.id} initialVote={voteSummary.currentVote} initialLikes={voteSummary.likes} initialDislikes={voteSummary.dislikes} isAuthenticated={isAuthenticated} isOwner={isOwner} />
                {!isOwner && (
                  <div className="flex flex-wrap gap-2">
                    <FollowButton followingUserId={profile.user_id} initialFollowing={isFollowing} isAuthenticated={isAuthenticated} />
                    <BookmarkButton targetType="profile" targetId={profile.id} initialBookmarked={isBookmarked} isAuthenticated={isAuthenticated} />
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-12">
            {visibleSections.map((section) => (
              <div
                key={section.id}
                className={getSectionSpan(presentation.sectionSizes[section.id])}
              >
                <SectionCard title={section.title} accentColor={presentation.accentColor}>
                  {section.content}
                </SectionCard>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

const CAROUSEL_THRESHOLD = 4;
const VIEW_ALL_THRESHOLD = 10;

function ProfileItemsBlock({
  children,
  description,
  viewAllLabel,
  viewAllHref,
  totalCount,
  carouselPrev,
  carouselNext,
}: {
  children: ReactNode;
  description: string;
  viewAllLabel: string;
  viewAllHref: string | null;
  totalCount: number;
  carouselPrev: string;
  carouselNext: string;
}) {
  const items = Array.isArray(children) ? children : [children];
  const showCarousel = totalCount >= CAROUSEL_THRESHOLD;
  const showViewAll = totalCount > VIEW_ALL_THRESHOLD && Boolean(viewAllHref);

  return (
    <>
      <p className="text-sm leading-7 app-muted">{description}</p>

      <div className="mt-5">
        {showCarousel ? (
          <HorizontalCarousel
            itemMinWidth={300}
            ariaLabelPrev={carouselPrev}
            ariaLabelNext={carouselNext}
          >
            {items}
          </HorizontalCarousel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">{items}</div>
        )}
      </div>

      {showViewAll && viewAllHref ? (
        <div className="mt-5">
          <ButtonLink href={viewAllHref} variant="secondary" size="sm">
            {viewAllLabel} ({totalCount})
          </ButtonLink>
        </div>
      ) : null}
    </>
  );
}

type ProfileArticleSummary = PublicProfilePageData["articles"][number];

function ProfileArticleCard({
  article,
  locale,
}: {
  article: ProfileArticleSummary;
  locale: string;
}) {
  const dateLabel = (() => {
    const value = article.published_at || article.created_at;
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  })();

  return (
    <LocalizedLink
      href={`/articles/${article.slug}`}
      className="group block h-full overflow-hidden rounded-[1.75rem] app-card transition hover:-translate-y-0.5 hover:shadow-xl"
    >
      <div className="relative aspect-[16/10] bg-[color:var(--surface-muted)]">
        {article.cover_image_url ? (
          <OptimizedImage
            src={article.cover_image_url}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : null}
      </div>

      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-[color:var(--foreground)]">
          {article.title}
        </h3>
        {article.excerpt ? (
          <p className="line-clamp-3 text-sm app-muted">{article.excerpt}</p>
        ) : null}
        {dateLabel ? (
          <p className="text-xs app-soft">{dateLabel}</p>
        ) : null}
      </div>
    </LocalizedLink>
  );
}
