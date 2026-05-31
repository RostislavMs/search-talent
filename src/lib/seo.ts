import type { Metadata } from "next";
import {
  createLocalePath,
  defaultLocale,
  locales,
  type Locale,
} from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function getMetadataBase() {
  return new URL(getSiteUrl());
}

/**
 * Serialize a value as JSON-LD safe to embed inside a <script> tag.
 *
 * Why: `JSON.stringify` does not escape `</script>` or other HTML/JSON-in-HTML
 * hazards. User-controlled fields (article title, profile name, etc.) flow
 * into our JSON-LD blocks, so an unescaped `</script>` would terminate the
 * script element early and turn into stored XSS — and also break Google rich
 * results parsing.
 */
const JSON_LD_DANGEROUS_CHARS = new RegExp("[<>&" + String.fromCharCode(0x2028) + String.fromCharCode(0x2029) + "]", "g");
const JSON_LD_ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  ">": "\\u003e",
  "&": "\\u0026",
  " ": "\\u2028",
  " ": "\\u2029",
};

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(
    JSON_LD_DANGEROUS_CHARS,
    (char) => JSON_LD_ESCAPES[char] ?? char,
  );
}

export function buildMetadata({
  locale,
  pathname,
  title,
  description,
  noindex = false,
}: {
  locale: Locale;
  pathname: string;
  title: string;
  description: string;
  noindex?: boolean;
}): Metadata {
  const dictionary = getDictionary(locale);
  const canonicalPath = createLocalePath(locale, pathname);

  const metadata: Metadata = {
    metadataBase: getMetadataBase(),
    title,
    description,
    alternates: {
      canonical: canonicalPath,
      languages: {
        ...Object.fromEntries(
          locales.map((item) => [
            item,
            new URL(
              createLocalePath(item, pathname),
              getMetadataBase(),
            ).toString(),
          ]),
        ),
        "x-default": new URL(
          createLocalePath(defaultLocale, pathname),
          getMetadataBase(),
        ).toString(),
      },
    },
    openGraph: {
      type: "website",
      url: new URL(canonicalPath, getMetadataBase()),
      locale: locale === "uk" ? "uk_UA" : "en_US",
      title,
      description,
      siteName: dictionary.site.name,
      images: [
        {
          url: new URL("/logo.webp", getMetadataBase()).toString(),
          alt: dictionary.site.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [new URL("/logo.webp", getMetadataBase()).toString()],
    },
  };

  metadata.robots = noindex
    ? {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
          index: false,
          follow: false,
          noimageindex: true,
        },
      }
    : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-snippet": -1,
          "max-image-preview": "large",
          "max-video-preview": -1,
        },
      };

  return metadata;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function joinList(values: string[]) {
  return values.filter(Boolean).join(", ");
}

function getWorkFormatLabel(locale: Locale, value: string) {
  const dictionary = getDictionary(locale);

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

export function buildFaqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildAutoProfileSeoParagraph({
  locale,
  projectCount,
  topTechnologies,
  experienceYears,
  workFormats,
}: {
  locale: Locale;
  projectCount: number;
  topTechnologies: string[];
  experienceYears: number | null;
  workFormats: string[] | null;
}) {
  const technologiesLabel = topTechnologies.length > 0
    ? joinList(topTechnologies.slice(0, 3))
    : locale === "uk"
      ? "різних технологій"
      : "multiple technologies";
  const workFormatLabel =
    workFormats && workFormats.length > 0
      ? joinList(workFormats.map((item) => getWorkFormatLabel(locale, item)))
      : locale === "uk"
        ? "різні формати співпраці"
        : "multiple work formats";
  const experienceLabel =
    experienceYears !== null
      ? locale === "uk"
        ? `${experienceYears} років досвіду.`
        : `${experienceYears} years experience.`
      : locale === "uk"
        ? "Досвід вказано у профілі."
        : "Experience details are listed on the profile.";

  if (locale === "uk") {
    return `${projectCount} проєктів із використанням ${technologiesLabel}. ${experienceLabel} Доступний для ${workFormatLabel}.`;
  }

  return `${projectCount} projects using ${technologiesLabel}. ${experienceLabel} Available for ${workFormatLabel}.`;
}

export function buildProfilePageMetadata({
  locale,
  pathname,
  name,
  role,
  country,
  projectCount,
  bio,
  fallbackParagraph,
  noindex = false,
}: {
  locale: Locale;
  pathname: string;
  name: string | null;
  role: string | null;
  country: string | null;
  projectCount: number;
  bio: string | null;
  fallbackParagraph: string | null;
  noindex?: boolean;
}) {
  const titleName = name || (locale === "uk" ? "Фахівець" : "Specialist");
  const roleLabel = role || (locale === "uk" ? "IT-фахівець" : "IT specialist");
  const title =
    locale === "uk"
      ? `${titleName} — портфоліо ${roleLabel}`
      : `${titleName} — ${roleLabel} Portfolio`;
  const descriptionSource = bio?.trim() || fallbackParagraph || "";
  const fallback =
    locale === "uk"
      ? `${roleLabel}${country ? ` з ${country}` : ""}. ${projectCount} проєктів у портфоліо на SearchTalent.`
      : `${roleLabel}${country ? ` from ${country}` : ""}. ${projectCount} projects in portfolio on SearchTalent.`;
  const description = truncateText(descriptionSource || fallback, 155);

  return buildMetadata({
    locale,
    pathname,
    title,
    description,
    noindex,
  });
}

export function buildProjectPageMetadata({
  locale,
  pathname,
  projectTitle,
  topTechnologies,
  authorName,
  category,
  descriptionText,
  noindex = false,
}: {
  locale: Locale;
  pathname: string;
  projectTitle: string | null;
  topTechnologies: string[];
  authorName: string | null;
  category: string | null;
  descriptionText: string | null;
  noindex?: boolean;
}) {
  const safeTitle = projectTitle || (locale === "uk" ? "Проєкт" : "Project");
  const safeAuthor = authorName || (locale === "uk" ? "автором" : "the author");
  const hasTech = topTechnologies.length > 0;
  const topTech = topTechnologies[0] || (locale === "uk" ? "сучасним стеком" : "modern tools");
  const stack = joinList(topTechnologies.slice(0, 3));
  const categoryLabel = category || (locale === "uk" ? "IT-проєкт" : "IT project");
  const title =
    locale === "uk"
      ? `${safeTitle} — створено з ${topTech} автором ${safeAuthor}`
      : `${safeTitle} — Built with ${topTech} by ${safeAuthor}`;
  // Only mention the stack when the project actually lists technologies —
  // otherwise the genitive "на стеку <stack>" template collides with the
  // "сучасним стеком" fallback and reads as "на стеку сучасним стеком".
  const fallback =
    locale === "uk"
      ? hasTech
        ? `${categoryLabel} на стеку ${stack}. Портфоліо на SearchTalent.`
        : `${categoryLabel}. Портфоліо на SearchTalent.`
      : hasTech
        ? `${categoryLabel} built with ${stack}. Portfolio on SearchTalent.`
        : `${categoryLabel}. Portfolio on SearchTalent.`;
  const description = truncateText(descriptionText || fallback, 155);

  return buildMetadata({
    locale,
    pathname,
    title,
    description,
    noindex,
  });
}

export function buildArticlePageMetadata({
  locale,
  pathname,
  title,
  excerpt,
  noindex = false,
}: {
  locale: Locale;
  pathname: string;
  title: string | null;
  excerpt: string | null;
  noindex?: boolean;
}) {
  return buildMetadata({
    locale,
    pathname,
    title: title || (locale === "uk" ? "Стаття" : "Article"),
    description: truncateText(
      excerpt ||
        (locale === "uk"
          ? "Технічна стаття та матеріали спільноти SearchTalent."
          : "Technical article and community writing from SearchTalent."),
      155,
    ),
    noindex,
  });
}

export function buildTalentCategoryMetadata({
  locale,
  pathname,
  role,
  count,
  noindex = false,
}: {
  locale: Locale;
  pathname: string;
  role: string;
  count: number;
  noindex?: boolean;
}) {
  const title =
    locale === "uk"
      ? `${role} — портфоліо та фахівці`
      : `${role} Portfolios & Talents`;
  const description =
    locale === "uk"
      ? `Переглядайте ${count} публічних профілів у категорії ${role}. Реальні проєкти, стек технологій і публічні портфоліо на SearchTalent.`
      : `Browse ${count} verified ${role} portfolios. Real projects, tech stacks, and public talent profiles on SearchTalent.`;

  return buildMetadata({
    locale,
    pathname,
    title,
    description,
    noindex,
  });
}

export function buildTechnologyTalentsMetadata({
  locale,
  pathname,
  technology,
  count,
  noindex = false,
}: {
  locale: Locale;
  pathname: string;
  technology: string;
  count: number;
  noindex?: boolean;
}) {
  const title =
    locale === "uk"
      ? `${technology} — фахівці з реальними портфоліо`
      : `${technology} Talents with Real Portfolios`;
  const description =
    locale === "uk"
      ? `Переглядайте ${count} публічних профілів фахівців, які працюють з ${technology}. Реальні проєкти, стек і кейси на SearchTalent.`
      : `Browse ${count} public profiles of specialists working with ${technology}. Real projects, stacks, and portfolios on SearchTalent.`;

  return buildMetadata({
    locale,
    pathname,
    title,
    description,
    noindex,
  });
}

export function buildProjectsTagMetadata({
  locale,
  pathname,
  technology,
  count,
  noindex = false,
}: {
  locale: Locale;
  pathname: string;
  technology: string;
  count: number;
  noindex?: boolean;
}) {
  const title =
    locale === "uk"
      ? `${technology} — IT-проєкти з публічним портфоліо`
      : `${technology} IT Projects & Portfolios`;
  const description =
    locale === "uk"
      ? `${count} публічних IT-проєктів зі стеком ${technology}. Скриншоти, контекст виконання та автори на SearchTalent.`
      : `${count} public IT projects built with ${technology}. Screenshots, delivery context, and creators on SearchTalent.`;

  return buildMetadata({
    locale,
    pathname,
    title,
    description,
    noindex,
  });
}

export function buildArticleCategoryMetadata({
  locale,
  pathname,
  categoryName,
  noindex = false,
}: {
  locale: Locale;
  pathname: string;
  categoryName: string;
  noindex?: boolean;
}) {
  const title =
    locale === "uk"
      ? `${categoryName} — статті та матеріали`
      : `${categoryName} — Articles & Guides`;
  const description =
    locale === "uk"
      ? `Читайте свіжі матеріали у категорії ${categoryName}: гайди, поради й кейси від спільноти SearchTalent.`
      : `Read the latest articles in the ${categoryName} category: guides, insights, and case studies from the SearchTalent community.`;

  return buildMetadata({
    locale,
    pathname,
    title,
    description,
    noindex,
  });
}

/* ------------------------------------------------------------------ */
/*  Schema.org JSON-LD helpers                                        */
/* ------------------------------------------------------------------ */

export function buildOrganizationSchema() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SearchTalent",
    url: siteUrl,
    logo: `${siteUrl}/favicon.webp`,
    description:
      "SearchTalent — a community platform where developers, designers, and IT specialists publish portfolios, projects, and articles.",
    sameAs: [],
  };
}

export function buildWebSiteSchema() {
  const siteUrl = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SearchTalent",
    url: siteUrl,
    description:
      "Community platform to discover IT talent, explore portfolios, and follow developers and designers.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/en/talents?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

function normalizeSameAsUrl(value: string | null | undefined, prefix?: string) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (!prefix) {
    return null;
  }

  const handle = trimmed.replace(/^@+/, "");
  return `${prefix}${handle}`;
}

export function buildPersonSchema({
  name,
  username,
  headline,
  avatarUrl,
  skills,
  url,
  sameAs,
  languages,
  currentPosition,
  mostRecentEducation,
}: {
  name: string | null;
  username: string | null;
  headline: string | null;
  avatarUrl: string | null;
  skills: string[];
  url: string;
  sameAs?: string[];
  languages?: string[];
  currentPosition?: { position: string | null; company: string | null } | null;
  mostRecentEducation?: { institution: string | null; degree: string | null } | null;
}) {
  const siteUrl = getSiteUrl();
  const cleanSameAs = (sameAs || []).filter(
    (value): value is string => Boolean(value),
  );
  const cleanLanguages = (languages || []).filter(Boolean);
  const image =
    avatarUrl
      ? {
          "@type": "ImageObject" as const,
          url: avatarUrl,
        }
      : null;
  const worksFor =
    currentPosition && currentPosition.company
      ? {
          "@type": "Organization" as const,
          name: currentPosition.company,
          ...(currentPosition.position ? { roleName: currentPosition.position } : {}),
        }
      : null;
  const alumniOf =
    mostRecentEducation && mostRecentEducation.institution
      ? {
          "@type": "EducationalOrganization" as const,
          name: mostRecentEducation.institution,
          ...(mostRecentEducation.degree ? { description: mostRecentEducation.degree } : {}),
        }
      : null;

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: name || username || "Specialist",
    url,
    ...(headline ? { jobTitle: headline } : {}),
    ...(image ? { image } : {}),
    ...(skills.length > 0 ? { knowsAbout: skills } : {}),
    ...(cleanSameAs.length > 0 ? { sameAs: cleanSameAs } : {}),
    ...(cleanLanguages.length > 0 ? { knowsLanguage: cleanLanguages } : {}),
    ...(worksFor ? { worksFor } : {}),
    ...(alumniOf ? { alumniOf } : {}),
    memberOf: {
      "@type": "Organization",
      name: "SearchTalent",
      url: siteUrl,
    },
  };
}

export function buildPersonSameAs({
  website,
  github,
  twitter,
  linkedin,
}: {
  website: string | null;
  github: string | null;
  twitter: string | null;
  linkedin: string | null;
}) {
  return [
    normalizeSameAsUrl(website),
    normalizeSameAsUrl(github, "https://github.com/"),
    normalizeSameAsUrl(twitter, "https://twitter.com/"),
    normalizeSameAsUrl(linkedin, "https://www.linkedin.com/in/"),
  ].filter((value): value is string => Boolean(value));
}

export function buildProfilePageSchema({
  url,
  person,
  dateCreated,
  dateModified,
}: {
  url: string;
  person: ReturnType<typeof buildPersonSchema>;
  dateCreated: string | null;
  dateModified: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    mainEntity: person,
    ...(dateCreated ? { dateCreated } : {}),
    ...(dateModified ? { dateModified } : {}),
  };
}

export function buildProjectSchema({
  title,
  description,
  url,
  imageUrl,
  authorName,
  authorUrl,
  technologies,
  dateCreated,
  dateModified,
  demoUrl,
  codeRepository,
}: {
  title: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  technologies: string[];
  dateCreated: string | null;
  dateModified?: string | null;
  demoUrl?: string | null;
  codeRepository?: string | null;
}) {
  const creator = authorName
    ? {
        "@type": "Person" as const,
        name: authorName,
        ...(authorUrl ? { url: authorUrl } : {}),
      }
    : null;
  const image = imageUrl
    ? {
        "@type": "ImageObject" as const,
        url: imageUrl,
      }
    : null;

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: title,
    ...(description ? { description } : {}),
    url,
    ...(demoUrl ? { sameAs: demoUrl } : {}),
    ...(image ? { image } : {}),
    ...(creator ? { creator, author: creator } : {}),
    ...(technologies.length > 0
      ? { keywords: technologies.join(", "), about: technologies }
      : {}),
    ...(codeRepository ? { codeRepository } : {}),
    ...(dateCreated ? { dateCreated } : {}),
    ...(dateModified ? { dateModified } : {}),
  };
}

export function buildArticleSchema({
  title,
  excerpt,
  url,
  imageUrl,
  authorName,
  authorUrl,
  datePublished,
  dateModified,
  articleSection,
  keywords,
  wordCount,
}: {
  title: string;
  excerpt: string | null;
  url: string;
  imageUrl: string | null;
  authorName: string | null;
  authorUrl: string | null;
  datePublished: string | null;
  dateModified: string | null;
  articleSection?: string | null;
  keywords?: string[];
  wordCount?: number | null;
}) {
  const siteUrl = getSiteUrl();
  const image = imageUrl
    ? {
        "@type": "ImageObject" as const,
        url: imageUrl,
        width: 1200,
        height: 630,
      }
    : null;
  const cleanKeywords = (keywords || []).filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    ...(excerpt ? { description: excerpt } : {}),
    url,
    mainEntityOfPage: url,
    ...(image ? { image } : {}),
    ...(authorName
      ? {
          author: {
            "@type": "Person",
            name: authorName,
            ...(authorUrl ? { url: authorUrl, sameAs: [authorUrl] } : {}),
          },
        }
      : {}),
    publisher: {
      "@type": "Organization",
      name: "SearchTalent",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/favicon.webp`,
      },
    },
    ...(articleSection ? { articleSection } : {}),
    ...(cleanKeywords.length > 0 ? { keywords: cleanKeywords.join(", ") } : {}),
    ...(typeof wordCount === "number" && wordCount > 0 ? { wordCount } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
  };
}

export function countWords(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  return value
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0).length;
}

export function buildBreadcrumbSchema(
  items: Array<{ name: string; url: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
