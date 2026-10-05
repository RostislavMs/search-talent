import type { CSSProperties, ReactNode } from "react";
import dynamic from "next/dynamic";
import AdminContentQuickActions from "@/components/admin-content-quick-actions";
import BadgeShelf from "@/components/badge-shelf";
import BookmarkButton from "@/components/bookmark-button";
import CollapsibleTags from "@/components/collapsible-tags";
import ExpandableProfileBio from "@/components/expandable-profile-bio";
import ProfileCompletenessButton from "@/components/profile-completeness-button";
import FollowButton from "@/components/follow-button";
import ProfileAiSummaryPublic from "@/components/profile-ai-summary-public";
import ProfileContactButton, {
  type ProfileContactInfo,
} from "@/components/profile-contact-button";
import ProfileShareDialog from "@/components/profile-share-dialog";
import ProfileVoteButtons from "@/components/profile-vote-buttons";

const ProfilePdfExport = dynamic(
  () => import("@/components/profile-pdf-export"),
);
import ProjectCard from "@/components/project-card";
import VerifiedBadge from "@/components/verified-badge";
import { ButtonLink } from "@/components/ui/Button";
import ShareButton from "@/components/ui/share-button";
import LocalizedLink from "@/components/ui/localized-link";
import OptimizedImage from "@/components/ui/optimized-image";
import type { PublicProfilePageData } from "@/lib/db/public";
import {
  getProfileFontStack,
  getProfileHeroBackground,
  getProfileHeroOverlay,
  getProfileItemsGridClass,
  getProfileSectionCardStyle,
  getProfileTextScale,
  getReadableTextColor,
  isDefaultProfileTheme,
  pickProfileProjects,
  PROFILE_ARTICLES_LIMIT,
  withAlpha,
  type ProfilePresentation,
  type ProfileSectionId,
  type ProfileSectionSize,
} from "@/lib/profile-presentation";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatOpenToList } from "@/lib/open-to";
import { formatHourlyRate } from "@/lib/profile-private";
import { formatScore } from "@/lib/plural";
import { getMetadataBase } from "@/lib/seo";

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
  cardStyle,
  className,
  children,
}: {
  title: string;
  accentColor: string;
  cardStyle?: CSSProperties;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl p-4 sm:rounded-panel sm:p-6 ${className ?? ""}`}
      style={cardStyle}
    >
      <div className="mb-4 h-[3px] w-10 rounded-full" style={{ backgroundColor: accentColor }} />
      <h2 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function getThemeStyle(presentation: ProfilePresentation) {
  const accent = presentation.accentColor;
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
        ? withAlpha(accent, 0.8)
        : withAlpha(presentation.textColor, 0.12),
    "--muted-foreground": presentation.mutedColor,
    "--soft-foreground": withAlpha(presentation.mutedColor, 0.84),
    "--shadow": `0 28px 90px ${withAlpha("#020617", 0.26)}`,
    // Drive every accent-coloured control inside the profile (buttons, links,
    // vote/follow actions, badges, sliders…) from the chosen accent instead of
    // the site-wide brand colour, so the "Accent" picker actually applies.
    "--brand": accent,
    "--brand-strong": `color-mix(in srgb, ${accent} 85%, #000)`,
    // Accent-coloured *text* is darkened harder than the fill colour, mirroring
    // the --brand-strong/--brand-ink split in globals.css. Without this the
    // profile would keep the site-wide brand ink and ignore the accent.
    "--brand-ink": `color-mix(in srgb, ${accent} 70%, #000)`,
    "--brand-soft": withAlpha(accent, 0.16),
    // Text on the soft accent fill (score pills). The raw accent vanished on a
    // panel of a similar hue (purple on purple); pulling it towards the
    // theme's text colour keeps the tint and makes it readable on light and
    // dark palettes alike.
    "--brand-on-soft": `color-mix(in srgb, ${accent} 55%, ${presentation.textColor})`,
    // Legible label for accent-coloured controls, derived from the accent
    // itself — not the background colour — so changing the profile background
    // never recolours button/badge text (e.g. the "Edit profile" button).
    "--brand-foreground": getReadableTextColor(accent),
    "--brand-ring": withAlpha(accent, 0.34),
    "--ring": accent,
    "--brand-hero": `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 70%, #000) 100%)`,
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
    badges,
    completeness,
    contact,
    salary,
    hourlyRate,
    voteSummary,
    profileRating,
    isAuthenticated,
    isOwner,
    isBookmarked,
    isFollowing,
  } = data;
  const presentation = profile.presentation;
  const typeScale = getProfileTextScale(presentation.textScale);
  const displayName = profile.name || profile.username || dictionary.common.creator;
  const siteBase = getMetadataBase().toString().replace(/\/$/, "");
  const profileUrl = profile.username ? `${siteBase}/${locale}/u/${profile.username}` : null;
  // What the owner hands out (share panel, PDF): no locale, so each visitor
  // lands on the page in their own language.
  const portfolioUrl = profile.username ? `${siteBase}/u/${profile.username}` : null;
  const hasPrivateContact = contact.hasEmail || contact.hasPhone;
  const openToList = formatOpenToList(profile.open_to, dictionary.openTo.phrases);
  const openToLine = openToList ? dictionary.openTo.badge.replace("{list}", openToList) : null;
  const hourlyRateLine = hourlyRate
    ? formatHourlyRate(hourlyRate, dictionary.openTo.hourlyRateValue, locale)
    : null;
  const workFormatsLine =
    (profile.work_formats?.length || 0) > 0
      ? `${dictionary.openTo.workFormats}: ${(profile.work_formats || [])
          .map((item) => getWorkFormatLabel(item, dictionary))
          .join(", ")}`
      : null;
  const contactInfo: ProfileContactInfo = {
    profileId: profile.id,
    displayName,
    telegram: profile.telegram_username,
    linkedin: profile.linkedin,
    website: profile.website,
    preferred: profile.preferred_contact_method,
    hasEmail: contact.hasEmail,
    hasPhone: contact.hasPhone,
    openToLine,
    hourlyRateLine,
    workFormatsLine,
  };
  const { featured: featuredProject, grid: gridProjects } = pickProfileProjects(
    projects,
    presentation.sectionSizes.projects,
  );
  const experienceLabel = getExperienceLabel(profile.experience_level, locale);
  // "1 рік" alone reads as anything; the hero says "1 рік досвіду".
  // "No experience" already says what it is.
  const experienceChip =
    experienceLabel && profile.experience_level !== "no_experience"
      ? dictionary.creatorProfile.experienceChip.replace("{value}", experienceLabel)
      : experienceLabel;
  const ratingChip =
    typeof profileRating === "number" ? formatScore(profileRating, dictionary.common) : null;
  // Hiding the contacts block (Visibility → Contacts) hides the button too.
  const canContact =
    !isOwner &&
    profile.visibility.links &&
    Boolean(hasPrivateContact || profile.telegram_username || profile.linkedin || profile.website);
  const sectionMap = new Map<ProfileSectionId, { title: string; content: ReactNode; visible: boolean }>([
    // The headline already sits under the name in the hero, so "About" carries
    // only the bio instead of repeating it in a "Position" box.
    ["about", { title: dictionary.creatorProfile.about, visible: profile.visibility.about && Boolean(profile.bio), content: <div style={{ fontSize: `${typeScale.body}rem` }}><ExpandableProfileBio content={profile.bio || ""} locale={locale} accentColor={presentation.accentColor} /></div> }],
    ["professionalDetails", { title: dictionary.creatorProfile.professionalDetails, visible: profile.visibility.professionalDetails && Boolean(profile.experience_level || salary || hourlyRate || profile.open_to.length > 0 || (profile.work_formats?.length || 0) > 0 || profile.additional_info), content: <div className="space-y-4"><div className="grid gap-4 md:grid-cols-2">{profile.experience_level && <div className="rounded-2xl app-panel p-3 sm:p-4"><p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{dictionary.creatorProfile.totalExperienceYears}</p><p className="mt-2 text-sm text-[color:var(--foreground)]">{getExperienceLabel(profile.experience_level, locale)}</p></div>}{salary && <div className="rounded-2xl app-panel p-3 sm:p-4"><p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{dictionary.creatorProfile.salaryExpectations}</p><p className="mt-2 text-sm text-[color:var(--foreground)]">{salary.amount}{salary.currency ? ` ${salary.currency.toUpperCase()}` : ""}</p></div>}{hourlyRateLine && <div className="rounded-2xl app-panel p-3 sm:p-4"><p className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{dictionary.openTo.hourlyRate}</p><p className="mt-2 text-sm text-[color:var(--foreground)]">{hourlyRateLine}</p></div>}</div>{profile.open_to.length > 0 && <div><p className="text-sm font-medium text-[color:var(--foreground)]">{dictionary.openTo.toggle}</p><div className="mt-2 flex flex-wrap gap-2">{profile.open_to.map((item) => <span key={item} className="rounded-full app-panel px-3 py-1 text-sm app-muted">{dictionary.openTo.options[item]}</span>)}</div></div>}{(profile.work_formats?.length || 0) > 0 && <div><p className="text-sm font-medium text-[color:var(--foreground)]">{dictionary.creatorProfile.workFormats}</p><div className="mt-2 flex flex-wrap gap-2">{(profile.work_formats || []).map((item) => <span key={item} className="rounded-full app-panel px-3 py-1 text-sm app-muted">{getWorkFormatLabel(item, dictionary)}</span>)}</div></div>}{profile.additional_info && <p className="text-sm leading-8 app-muted" style={{ fontSize: `${typeScale.body}rem` }}>{profile.additional_info}</p>}</div> }],
    ["workExperience", { title: dictionary.creatorProfile.workExperience, visible: profile.visibility.workExperience && workExperience.length > 0, content: <div className="space-y-4">{workExperience.map((item) => <article key={item.id} className="rounded-2xl app-panel p-3 sm:p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[color:var(--foreground)]">{item.position || "—"}</h3><p className="mt-1 text-sm app-muted">{item.company_name || "—"}</p></div><span className="text-sm app-soft">{item.started_year || "—"} - {item.is_current ? dictionary.creatorProfile.present : item.ended_year || "—"}</span></div>{item.responsibilities && <p className="mt-3 text-sm leading-7 app-muted">{item.responsibilities}</p>}</article>)}</div> }],
    ["skills", { title: dictionary.creatorProfile.skills, visible: profile.visibility.skills && technologies.length > 0, content: <CollapsibleTags items={technologies} initialCount={12} showMoreLabel={dictionary.creatorProfile.skillsShowAll} showLessLabel={dictionary.creatorProfile.skillsShowLess} /> }],
    ["languages", { title: dictionary.creatorProfile.languages, visible: profile.visibility.languages && languages.length > 0, content: <div className="grid gap-3 md:grid-cols-2">{languages.map((item) => <div key={item.id} className="rounded-2xl app-panel p-3 sm:p-4"><p className="font-medium text-[color:var(--foreground)]">{item.name}</p><p className="mt-1 text-sm app-muted">{getLanguageLevelLabel(item.level, dictionary)}</p></div>)}</div> }],
    ["education", { title: dictionary.creatorProfile.education, visible: profile.visibility.education && education.length > 0, content: <div className="space-y-4">{education.map((item) => <article key={item.id} className="rounded-2xl app-panel p-3 sm:p-4"><h3 className="font-semibold text-[color:var(--foreground)]">{item.institution || "—"}</h3><p className="mt-1 text-sm app-muted">{[item.degree, item.field_of_study].filter(Boolean).join(" • ")}</p>{(item.started_on || item.completed_on) && <p className="mt-1 text-sm app-soft">{[item.started_on, item.completed_on].filter(Boolean).join(" - ")}</p>}{item.description && <p className="mt-3 text-sm leading-7 app-muted">{item.description}</p>}</article>)}</div> }],
    ["certificates", { title: dictionary.creatorProfile.certificates, visible: profile.visibility.certificates && certificates.length > 0, content: <div className="space-y-4">{certificates.map((item) => <article key={item.id} className="rounded-2xl app-panel p-3 sm:p-4"><h3 className="font-semibold text-[color:var(--foreground)]">{item.title || "—"}</h3><p className="mt-1 text-sm app-muted">{[item.issuer, item.issued_on].filter(Boolean).join(" • ")}</p><div className="mt-3 flex flex-wrap gap-2">{item.credential_url && <a href={item.credential_url} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">{dictionary.creatorProfile.openCertificateLink}</a>}{item.file_url && <a href={item.file_url} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">{item.file_name || dictionary.creatorProfile.openCertificateFile}</a>}</div></article>)}</div> }],
    ["qa", { title: dictionary.creatorProfile.qa, visible: profile.visibility.qa && qas.length > 0, content: <div className="space-y-4">{qas.map((item) => <article key={item.id} className="rounded-2xl app-panel p-3 sm:p-4"><h3 className="font-semibold text-[color:var(--foreground)]">{item.question || "—"}</h3><p className="mt-3 text-sm leading-7 app-muted">{item.answer || "—"}</p></article>)}</div> }],
    ["contacts", { title: dictionary.creatorProfile.contacts, visible: profile.visibility.links && Boolean(hasPrivateContact || profile.telegram_username || profile.website || profile.github || profile.twitter || profile.linkedin || profile.behance || profile.dribbble || profile.artstation || profile.vimeo || profile.youtube || profile.instagram), content: <div className="space-y-6"><div className="space-y-3 text-sm">{contact.email && <a href={`mailto:${contact.email}`} className="block text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4">{dictionary.creatorProfile.contactEmail}: {contact.email}</a>}{profile.telegram_username && <a href={`https://t.me/${profile.telegram_username.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="block text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4">{dictionary.creatorProfile.telegram}: @{profile.telegram_username.replace(/^@/, "")}</a>}{contact.phone && <a href={`tel:${contact.phone}`} className="block text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4">{dictionary.creatorProfile.phone}: {contact.phone}</a>}{profile.preferred_contact_method && <p className="app-muted">{dictionary.creatorProfile.preferredContactMethod}: {getPreferredContactMethodLabel(profile.preferred_contact_method, dictionary)}</p>}{isOwner && hasPrivateContact && <p className="text-xs leading-5 app-soft">{dictionary.openTo.privateContactsHint}</p>}{!isOwner && hasPrivateContact && <ProfileContactButton contact={contactInfo} isAuthenticated={isAuthenticated} variant="secondary" label={dictionary.openTo.showPrivate} />}</div><div><p className="text-sm font-medium text-[color:var(--foreground)]">{dictionary.creatorProfile.links}</p><div className="mt-3 flex flex-wrap gap-2">{profile.website && <a href={profile.website} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">Website</a>}{profile.github && <a href={profile.github} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">GitHub</a>}{profile.twitter && <a href={profile.twitter} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">X / Twitter</a>}{profile.linkedin && <a href={profile.linkedin} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">LinkedIn</a>}{profile.behance && <a href={profile.behance} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">Behance</a>}{profile.dribbble && <a href={profile.dribbble} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">Dribbble</a>}{profile.artstation && <a href={profile.artstation} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">ArtStation</a>}{profile.vimeo && <a href={profile.vimeo} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">Vimeo</a>}{profile.youtube && <a href={profile.youtube} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">YouTube</a>}{profile.instagram && <a href={profile.instagram} target="_blank" rel="noreferrer" className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]">Instagram</a>}</div></div></div> }],
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
            size={presentation.sectionSizes.projects}
            featured={
              featuredProject ? (
                <ProjectCard
                  dictionary={dictionary}
                  hideOwner
                  variant="featured"
                  priority
                  project={{
                    ...featuredProject,
                    slug: featuredProject.slug || "",
                    ownerName: profile.name,
                    ownerUsername: profile.username,
                  }}
                />
              ) : null
            }
            items={gridProjects.map((project) => (
              <ProjectCard
                key={project.id}
                dictionary={dictionary}
                hideOwner
                project={{
                  ...project,
                  slug: project.slug || "",
                  ownerName: profile.name,
                  ownerUsername: profile.username,
                }}
              />
            ))}
          />
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
            size={presentation.sectionSizes.articles}
            items={articles.slice(0, PROFILE_ARTICLES_LIMIT).map((item) => (
              <ProfileArticleCard
                key={item.id}
                article={item}
                locale={locale}
              />
            ))}
          />
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
  // A profile that hasn't been customised (or that the viewer has chosen to see
  // without others' customization) follows the site's light/dark theme instead
  // of the baked-in dark palette — so it reads white on the light theme. The
  // hero keeps the site-standard dark brand gradient (as every other hero on
  // the site does), so its own subtree is pinned to light-on-dark tokens while
  // the container and sections below adopt the theme.
  const followSiteTheme = isDefaultProfileTheme(presentation);
  const sectionCardStyle = followSiteTheme
    ? undefined
    : getProfileSectionCardStyle(presentation);
  const sectionCardClassName = followSiteTheme ? "app-card" : "";
  const accentBarColor = followSiteTheme
    ? "var(--brand)"
    : presentation.accentColor;
  const eyebrowColor = followSiteTheme
    ? "var(--muted-foreground)"
    : presentation.mutedColor;
  // The hero sits on a dark backdrop (brand gradient or a photo with a dark
  // overlay), so its whole subtree is pinned to light-on-dark. `color` is set
  // explicitly — not just `--foreground` — because headings like the name
  // inherit the `color` property rather than reading the variable, so without
  // it they'd keep the container's themed (dark) colour and vanish on the photo.
  const heroOnDarkVars = {
    color: "#ffffff",
    "--foreground": "#ffffff",
    "--muted-foreground": "rgba(255, 255, 255, 0.82)",
    "--soft-foreground": "rgba(255, 255, 255, 0.66)",
    "--surface": "rgba(255, 255, 255, 0.12)",
    "--surface-muted": "rgba(255, 255, 255, 0.1)",
    "--border": "rgba(255, 255, 255, 0.18)",
  } as CSSProperties & Record<`--${string}`, string>;
  const containerStyle: CSSProperties = followSiteTheme
    ? {
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        borderColor: "var(--border)",
        fontFamily: getProfileFontStack(presentation.fontPreset),
      }
    : {
        ...getThemeStyle(presentation),
        backgroundColor: presentation.surfaceColor,
        color: presentation.textColor,
        fontFamily: getProfileFontStack(presentation.fontPreset),
      };

  return (
    <main className="mx-auto max-w-[88rem] px-0 py-4 sm:px-6 sm:py-8">
      <div
        className="relative overflow-hidden rounded-none border-y sm:rounded-hero sm:border"
        style={containerStyle}
      >
        <div className="relative p-4 sm:p-6 lg:p-8">
          <section
            className={`relative overflow-hidden rounded-2xl p-4 sm:p-6 lg:flex lg:min-h-[22rem] lg:flex-col lg:justify-center lg:p-8 ${followSiteTheme ? "bg-brand-hero border app-border" : "app-card"}`}
            style={
              followSiteTheme
                ? heroOnDarkVars
                : { background: getProfileHeroBackground(presentation) }
            }
          >
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
            {presentation.backgroundUrl &&
              (presentation.backgroundMode === "image" ||
                presentation.backgroundMode === "video") && (
                <div
                  className="absolute inset-0 -z-0"
                  style={{ background: getProfileHeroOverlay(presentation) }}
                />
              )}
            <div className="relative grid grid-cols-1 gap-6 sm:gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <div className={presentation.heroAlignment === "center" ? "text-center" : "text-left"}>
                {!isOwner && isAdmin && (
                  <div className={`mb-4 flex flex-wrap items-center gap-3 sm:mb-5 ${presentation.heroAlignment === "center" ? "justify-center" : ""}`}>
                    <AdminContentQuickActions
                      targetType="profile"
                      targetId={profile.id}
                      currentStatus={profile.moderation_status}
                      locale={locale}
                      redirectAfterDelete="/talents"
                    />
                  </div>
                )}

                <div className={`flex items-center gap-3 sm:gap-4 ${presentation.heroAlignment === "center" ? "flex-col" : "flex-row"}`}>
                  <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl app-panel text-2xl font-semibold text-[color:var(--foreground)] sm:h-20 sm:w-20 sm:rounded-3xl sm:text-3xl">
                    {profile.avatar_url ? <OptimizedImage src={profile.avatar_url} alt={displayName} fill sizes="(max-width: 640px) 64px, 80px" className="object-cover" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-eyebrow sm:text-xs" style={{ color: eyebrowColor }}>{profile.categoryName || dictionary.common.creator}</p>
                    <h1 className="font-display mt-1 font-semibold tracking-tight sm:mt-1.5" style={{ fontSize: `clamp(1.4rem, 3.6vw, ${2.2 * typeScale.heading}rem)`, lineHeight: 1.1 }}>{displayName}</h1>
                  </div>
                </div>

                <div className={`mt-3 flex flex-wrap items-center gap-2 sm:mt-4 ${presentation.heroAlignment === "center" ? "justify-center" : ""}`}>
                  <p className="text-sm app-muted">@{profile.username}</p>
                  <VerifiedBadge verified={profile.email_verified} />
                  {ratingChip && (
                    <LocalizedLink
                      href="/rating-guide"
                      aria-label={dictionary.creatorProfile.ratingChipLabel.replace("{score}", ratingChip)}
                      title={dictionary.creatorProfile.profileRating}
                      className="font-display rounded-full app-panel px-2.5 py-0.5 text-xs font-semibold text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)] sm:text-sm"
                    >
                      {ratingChip}
                    </LocalizedLink>
                  )}
                </div>
                {profile.headline && <p className="mt-3 text-sm leading-6 app-muted sm:leading-7">{profile.headline}</p>}
                <div className={`mt-3 flex flex-wrap items-center gap-1.5 sm:mt-4 ${presentation.heroAlignment === "center" ? "justify-center" : ""}`}>
                  {(profile.city || profile.countryName) && <span className="rounded-full app-panel px-2.5 py-0.5 text-xs app-muted sm:text-sm">{[profile.city, profile.countryName].filter(Boolean).join(", ")}</span>}
                  {experienceChip && <span className="rounded-full app-panel px-2.5 py-0.5 text-xs app-muted sm:text-sm">{experienceChip}</span>}
                  {isOwner && (
                    <ProfileCompletenessButton
                      completeness={completeness}
                      locale={locale}
                      editHref={`/${locale}/profile/edit`}
                    />
                  )}
                </div>
                {openToLine && (
                  <p className={`mt-3 flex items-center gap-2 text-sm font-medium sm:mt-4 ${presentation.heroAlignment === "center" ? "justify-center" : ""}`}>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span>
                      {openToLine}
                      {hourlyRateLine && <span className="font-normal app-muted"> · {hourlyRateLine}</span>}
                    </span>
                  </p>
                )}
                {badges.length > 0 && (
                  <div className={`mt-3 sm:mt-4 ${presentation.heroAlignment === "center" ? "flex justify-center" : ""}`}>
                    <BadgeShelf badges={badges} locale={locale} maxVisible={HERO_BADGES_VISIBLE} maxVisibleMobile={HERO_BADGES_VISIBLE_MOBILE} />
                  </div>
                )}
              </div>

              <div className="min-w-0 xl:self-end">
                <div className={`flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar [&>*]:shrink-0 sm:flex-wrap sm:gap-2 sm:overflow-visible ${presentation.heroAlignment === "center" ? "sm:justify-center" : "xl:justify-end"}`}>
                  {isOwner && (
                    <ButtonLink href="/profile/edit" size="sm">
                      {dictionary.creatorProfile.editProfile}
                    </ButtonLink>
                  )}
                  {canContact && (
                    <ProfileContactButton contact={contactInfo} isAuthenticated={isAuthenticated} />
                  )}
                  {!isOwner && (
                    <FollowButton followingUserId={profile.user_id} initialFollowing={isFollowing} isAuthenticated={isAuthenticated} />
                  )}
                  {!isOwner && (
                    <BookmarkButton targetType="profile" targetId={profile.id} initialBookmarked={isBookmarked} isAuthenticated={isAuthenticated} />
                  )}
                  <ProfilePdfExport data={data} portfolioUrl={portfolioUrl} label="PDF" />
                  {isOwner && portfolioUrl && profile.username ? (
                    <ProfileShareDialog
                      profileUrl={portfolioUrl}
                      username={profile.username}
                      openTo={profile.open_to}
                    />
                  ) : profileUrl ? (
                    <ShareButton url={profileUrl} title={displayName} align="end" />
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {profile.username ? (
            <div className="mt-4 sm:mt-6">
              <ProfileAiSummaryPublic
                username={profile.username}
                isAuthenticated={isAuthenticated}
              />
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-12">
            {visibleSections.map((section) => (
              <div
                key={section.id}
                className={`min-w-0 ${getSectionSpan(presentation.sectionSizes[section.id])}`}
              >
                <SectionCard
                  title={section.title}
                  accentColor={accentBarColor}
                  cardStyle={sectionCardStyle}
                  className={sectionCardClassName}
                >
                  {section.content}
                </SectionCard>
              </div>
            ))}
          </div>

          {/* Rated after the work, not before it: the score itself is a chip
              next to the name, the votes come once the visitor has seen why. */}
          <ProfileVoteButtons profileId={profile.id} initialVote={voteSummary.currentVote} initialLikes={voteSummary.likes} initialDislikes={voteSummary.dislikes} rating={profileRating} isAuthenticated={isAuthenticated} isOwner={isOwner} className="mt-4 rounded-panel bg-[color:var(--surface-muted)] p-4 sm:mt-6 sm:p-5" />
        </div>
      </div>
    </main>
  );
}

const HERO_BADGES_VISIBLE = 5;
const HERO_BADGES_VISIBLE_MOBILE = 4;

/**
 * Projects or articles on the profile: an optional featured card on top, then
 * a plain grid. No carousel — every shown piece of work is visible at once,
 * and "View all (N)" appears as soon as something is left out.
 */
function ProfileItemsBlock({
  items,
  featured = null,
  description,
  viewAllLabel,
  viewAllHref,
  totalCount,
  size,
}: {
  items: ReactNode[];
  featured?: ReactNode;
  description: string;
  viewAllLabel: string;
  viewAllHref: string | null;
  totalCount: number;
  size: ProfileSectionSize;
}) {
  const shownCount = items.length + (featured ? 1 : 0);
  const showViewAll = totalCount > shownCount && Boolean(viewAllHref);

  return (
    <>
      <p className="text-sm leading-7 app-muted">{description}</p>

      {featured ? <div className="mt-5">{featured}</div> : null}

      {items.length > 0 ? (
        <div className={`mt-5 grid gap-4 ${getProfileItemsGridClass(size)}`}>{items}</div>
      ) : null}

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
      className="group block h-full overflow-hidden rounded-panel app-card transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] bg-[color:var(--surface-muted)]">
        {article.cover_image_url ? (
          <OptimizedImage
            src={article.cover_image_url}
            alt={article.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
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
