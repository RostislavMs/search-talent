import type { Metadata } from "next";
import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import {
  CommunityLoopIllustration,
  KnowledgeVignette,
  OpenBuildIllustration,
  PlatformMapIllustration,
  PortfolioVignette,
  ProfileVignette,
  RecognitionVignette,
  ScatteredToProfileIllustration,
  StepFlowIllustration,
} from "@/components/illustrations/about-illustrations";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import MediaSplit from "@/components/ui/media-split";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";

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

  const metadata = buildMetadata({
    locale,
    pathname: "/about",
    title: dictionary.metadata.about.title,
    description: dictionary.metadata.about.description,
  });

  // The About title already names SearchTalent ("Про SearchTalent …"), so the
  // root "%s | SearchTalent" template would repeat the brand. Pin it as an
  // absolute title to keep the brand appearing exactly once.
  metadata.title = { absolute: dictionary.metadata.about.title };

  return metadata;
}

// ---- Icons -----------------------------------------------------------------
// One per "what you can do" row, so the list scans as a grid of marks instead
// of six lines of prose.

function IdCardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 16a3.5 3.5 0 0 1 6 0M14.5 10h4M14.5 14h2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10 9 5 3-5 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m14.5 5.5 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MedalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="m7 3 3 6m7-6-3 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="15" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="15" r="2" fill="currentColor" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="m9 15 2-4 4-2-2 4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 20c-5.5-3.6-8-6.5-8-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 3.5c0 3-2.5 5.9-8 9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Positional: each vignette and icon lines up with its dictionary entry, so
// adding an entry means adding a drawing here too.
const PILLAR_VIGNETTES = [
  ProfileVignette,
  PortfolioVignette,
  KnowledgeVignette,
  RecognitionVignette,
] as const;

const FEATURE_ICONS: Array<() => ReactElement> = [
  IdCardIcon,
  MediaIcon,
  PenIcon,
  MedalIcon,
  CompassIcon,
  HeartIcon,
];

const SECTION = "mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10";
const HEADING =
  "font-display text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl";
const BODY = "text-sm leading-7 app-muted sm:text-base sm:leading-8";
const ORDINAL = "text-xs font-semibold tracking-eyebrow text-[color:var(--brand-strong)]";

function ordinal(index: number) {
  return String(index + 1).padStart(2, "0");
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = await getLocaleValue(params);
  const dictionary = getDictionary(locale);

  const about = dictionary.aboutPage;

  return (
    <main className="mx-auto max-w-[88rem] px-0 py-10 sm:px-6">
      {/* Hero: two columns from lg up so the artwork fills the space the copy
          leaves empty, matching the rating guide. */}
      <section className="bg-brand-hero relative overflow-hidden rounded-none sm:rounded-hero border app-border p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/70 sm:text-sm">
            {about.eyebrow}
          </p>
          <LocalizedLink
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition hover:text-white"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            {about.backToHome}
          </LocalizedLink>
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">
              {about.title}
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/82 sm:text-base sm:leading-8">
              {about.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/signup">{about.ctaPrimary}</ButtonLink>
              <ButtonLink
                href="/talents"
                variant="ghost"
                className="border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
              >
                {about.ctaSecondary}
              </ButtonLink>
            </div>
          </div>
          {/* The scrim keeps the white line art readable over the amber end of
              the hero gradient. */}
          <div className="flex aspect-3/2 items-center justify-center rounded-2xl bg-[rgba(8,15,30,0.42)] p-5 text-white ring-1 ring-white/15 backdrop-blur-sm sm:p-7">
            <PlatformMapIllustration label={about.heroIllustrationLabel} />
          </div>
        </div>
      </section>

      {/* The platform at a glance */}
      <section className={SECTION} aria-labelledby="about-pillars">
        <h2 id="about-pillars" className={HEADING}>
          {about.pillarsTitle}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {about.pillars.map((pillar, index) => {
            const Vignette = PILLAR_VIGNETTES[index] ?? ProfileVignette;
            return (
              <article
                key={pillar.title}
                className="flex flex-col rounded-3xl border app-border p-5"
              >
                <div className="flex aspect-10/7 items-center justify-center rounded-2xl app-panel p-4">
                  <Vignette label={pillar.illustrationLabel} />
                </div>
                <p className={`mt-5 ${ORDINAL}`}>{ordinal(index)}</p>
                <h3 className="font-display mt-2 text-lg font-medium tracking-tight text-[color:var(--foreground)]">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-7 app-muted">{pillar.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className={SECTION} aria-labelledby="about-steps">
        <h2 id="about-steps" className={HEADING}>
          {about.stepsTitle}
        </h2>
        <p className={`mt-3 max-w-3xl ${BODY}`}>{about.stepsDescription}</p>
        <div className="mt-6 rounded-3xl app-panel px-4 py-7 sm:px-10 sm:py-9">
          <StepFlowIllustration label={about.stepsIllustrationLabel} />
        </div>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {about.steps.map((step, index) => (
            <li key={step.title} className="rounded-3xl border app-border p-5">
              <p className={ORDINAL}>{ordinal(index)}</p>
              <h3 className="font-display mt-2 text-lg font-medium tracking-tight text-[color:var(--foreground)]">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-7 app-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Mission */}
      <section className={SECTION} aria-labelledby="about-mission">
        <MediaSplit
          side="end"
          aspect="aspect-5/3"
          media={<ScatteredToProfileIllustration label={about.missionIllustrationLabel} />}
        >
          <h2 id="about-mission" className={HEADING}>
            {about.missionTitle}
          </h2>
          <p className={`mt-3 ${BODY}`}>{about.missionText}</p>
        </MediaSplit>
      </section>

      {/* What you can do */}
      <section className={SECTION} aria-labelledby="about-features">
        <h2 id="about-features" className={HEADING}>
          {about.featuresTitle}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {about.features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index] ?? IdCardIcon;
            return (
              <li
                key={feature}
                className="flex items-start gap-3.5 rounded-2xl app-panel p-4"
              >
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--surface)] text-[color:var(--brand-strong)] ring-1 app-border"
                  aria-hidden="true"
                >
                  <Icon />
                </span>
                <span className="pt-1.5 text-sm leading-6 text-[color:var(--foreground)]">
                  {feature}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Community & quality */}
      <section className={SECTION} aria-labelledby="about-community">
        <MediaSplit
          side="start"
          media={<CommunityLoopIllustration label={about.communityIllustrationLabel} />}
        >
          <h2 id="about-community" className={HEADING}>
            {about.communityTitle}
          </h2>
          <p className={`mt-3 ${BODY}`}>{about.communityText}</p>
        </MediaSplit>
      </section>

      {/* Built in the open */}
      <section className={SECTION} aria-labelledby="about-open-source">
        <MediaSplit
          side="end"
          aspect="aspect-16/9"
          media={<OpenBuildIllustration label={about.openSourceIllustrationLabel} />}
        >
          <h2 id="about-open-source" className={HEADING}>
            {about.openSourceTitle}
          </h2>
          <p className={`mt-3 ${BODY}`}>{about.openSourceText}</p>
        </MediaSplit>
      </section>

      {/* Closing call to action */}
      <section className={SECTION}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className={HEADING}>{about.ctaTitle}</h2>
            <p className={`mt-2 max-w-xl ${BODY}`}>{about.ctaText}</p>
          </div>
          <div className="flex flex-col gap-3 sm:shrink-0 sm:flex-row">
            <ButtonLink href="/signup" className="w-full sm:w-auto">
              {about.ctaPrimary}
            </ButtonLink>
            <ButtonLink href="/talents" variant="secondary" className="w-full sm:w-auto">
              {about.ctaSecondary}
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  );
}
