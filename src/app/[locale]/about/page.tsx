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
import Art from "@/components/ui/art";
import { ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import MediaSplit from "@/components/ui/media-split";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { beat } from "@/lib/motion";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/supabase/current-user";

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
// of six lines of prose. Each stroke carries `pathLength="1"` + `data-draw`:
// inside an `.app-art` wrapper that is what lets the mark draw itself as its
// row scrolls in (see the motion kit in globals.css).

function IdCardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" pathLength="1" data-draw />
      <circle cx="9" cy="11" r="2.2" stroke="currentColor" strokeWidth="1.6" pathLength="1" data-draw />
      <path d="M6 16a3.5 3.5 0 0 1 6 0M14.5 10h4M14.5 14h2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" pathLength="1" data-draw />
    </svg>
  );
}

function MediaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" pathLength="1" data-draw />
      <path d="m10 9 5 3-5 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" pathLength="1" data-draw />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" pathLength="1" data-draw />
      <path d="m14.5 5.5 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" pathLength="1" data-draw />
    </svg>
  );
}

function MedalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path d="m7 3 3 6m7-6-3 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" pathLength="1" data-draw />
      <circle cx="12" cy="15" r="5.5" stroke="currentColor" strokeWidth="1.6" pathLength="1" data-draw />
      <circle cx="12" cy="15" r="2" fill="currentColor" data-pulse />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" pathLength="1" data-draw />
      <path d="m9 15 2-4 4-2-2 4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" pathLength="1" data-draw />
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
        pathLength="1"
        data-draw
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

// `app-reveal` is the CSS scroll-timeline reveal from globals.css: no JS, no
// client boundary, and it self-disables under prefers-reduced-motion.
const SECTION =
  "mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10 app-reveal";
// Same shell, minus the reveal. The steps section opts out because its diagram
// column is sticky, and a sticky element sitting inside one whose `transform`
// is still being animated is not something to rely on.
const SECTION_STILL =
  "mt-6 rounded-none sm:rounded-hero app-card p-6 sm:mt-8 sm:p-10";
const HEADING =
  "font-display app-heading-rule text-2xl font-medium tracking-tight text-[color:var(--foreground)] sm:text-3xl";
const BODY = "text-sm leading-7 app-muted sm:text-base sm:leading-8";
const EYEBROW =
  "text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--brand-ink)]";
const ORDINAL = "text-xs font-semibold tracking-eyebrow text-[color:var(--brand-ink)]";

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
  const isSignedIn = Boolean(await getCurrentUser());

  const about = dictionary.aboutPage;

  // Both call-to-action pairs point at the next useful step rather than a fixed
  // one: someone who already has an account has nothing to gain from "create
  // your profile", so they are pointed at publishing instead.
  const primaryCta = {
    href: isSignedIn ? "/projects/new" : "/signup",
    label: isSignedIn ? about.ctaPrimaryAuthed : about.ctaPrimary,
  };

  return (
    <main className="mx-auto max-w-[88rem] px-0 py-10 sm:px-6">
      {/* Hero: two columns from lg up so the artwork fills the space the copy
          leaves empty, matching the rating guide. The copy column enters as one
          orchestrated stack (`app-enter`, transform only — the headline is the
          LCP element and paints at full opacity on the first frame), while the
          diagram draws itself in beside it. */}
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
          <div className="app-enter">
            <h1
              style={beat(0)}
              className="font-display text-3xl font-medium leading-[1.1] tracking-tight sm:text-4xl md:text-5xl"
            >
              {about.title}
            </h1>
            <p
              style={beat(1)}
              className="mt-4 text-sm leading-7 text-white/82 sm:text-base sm:leading-8"
            >
              {about.description}
            </p>
            {/* Three plain claims, dot-separated. Deliberately not chips: they
                are statements, not filters, so nothing here is hoverable. */}
            <ul
              style={beat(2)}
              className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-white/80"
            >
              {about.heroPoints.map((point, index) => (
                <li key={point} className="flex items-center gap-x-3">
                  {index > 0 ? (
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-brand" />
                  ) : null}
                  {point}
                </li>
              ))}
            </ul>
            <div style={beat(3)} className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href={primaryCta.href}>{primaryCta.label}</ButtonLink>
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
            <Art on="load">
              <PlatformMapIllustration label={about.heroIllustrationLabel} />
            </Art>
          </div>
        </div>
      </section>

      {/* Why this exists. The lead is the heading — one sentence, set large,
          with the claim itself picked out by a marker that sweeps in on scroll.
          Only the background moves; the text never changes colour. */}
      <section className={SECTION} aria-labelledby="about-mission">
        <MediaSplit
          side="end"
          aspect="aspect-5/3"
          media={
            <Art>
              <ScatteredToProfileIllustration label={about.missionIllustrationLabel} />
            </Art>
          }
        >
          <p className={EYEBROW}>{about.missionEyebrow}</p>
          <h2
            id="about-mission"
            className="font-display mt-4 text-2xl font-medium leading-snug tracking-tight text-[color:var(--foreground)] sm:text-3xl lg:text-[2.05rem] lg:leading-[1.3]"
          >
            {about.missionLeadBefore}
            <span className="app-mark">{about.missionLeadMark}</span>
          </h2>
          <p className={`mt-5 ${BODY}`}>{about.missionText}</p>
        </MediaSplit>
      </section>

      {/* What is inside */}
      <section className={SECTION} aria-labelledby="about-pillars">
        <h2 id="about-pillars" className={HEADING}>
          {about.pillarsTitle}
        </h2>
        <p className={`mt-3 max-w-3xl ${BODY}`}>{about.pillarsDescription}</p>
        <div className="app-cascade mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {about.pillars.map((pillar, index) => {
            const Vignette = PILLAR_VIGNETTES[index] ?? ProfileVignette;
            return (
              <article
                key={pillar.title}
                style={beat(index)}
                className="flex flex-col rounded-3xl border app-border p-5"
              >
                <div className="flex aspect-10/7 items-center justify-center rounded-2xl app-panel-brand p-4">
                  <Art>
                    <Vignette label={pillar.illustrationLabel} />
                  </Art>
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

      {/* How it works. The diagram draws itself left to right on the same
          scroll the reader is already making, and the rule down the list fills
          to match. It is pinned so it stays in frame for all three steps —
          which only bites on a short viewport, where the list outruns it. */}
      <section className={SECTION_STILL} aria-labelledby="about-steps">
        <h2 id="about-steps" className={HEADING}>
          {about.stepsTitle}
        </h2>
        <p className={`mt-3 max-w-3xl ${BODY}`}>{about.stepsDescription}</p>
        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:items-start lg:gap-12">
          <div className="rounded-3xl app-panel-brand px-4 py-7 sm:px-8 lg:sticky lg:top-24">
            <Art>
              <StepFlowIllustration label={about.stepsIllustrationLabel} />
            </Art>
          </div>
          {/* The markers hang at `-left-<pad>`, which puts them flush against
              the list's own left edge; the rule they sit on is 2px wide at
              `left-1`, so both land on the same 5px centre line at either
              padding step. Change one and the other has to move with it. */}
          <ol className="relative grid gap-9 pl-9 sm:pl-11 lg:gap-12">
            <span
              aria-hidden="true"
              className="app-spine absolute bottom-3 left-1 top-3 w-0.5 rounded-full"
            />
            {about.steps.map((step, index) => (
              <li key={step.title} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-9 top-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--brand-strong)] ring-4 ring-[color:var(--surface)] sm:-left-11"
                />
                <p className={ORDINAL}>{ordinal(index)}</p>
                <h3 className="font-display mt-2 text-lg font-medium tracking-tight text-[color:var(--foreground)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-7 app-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you can do. One `app-art` wrapper around the whole list, so all
          six marks share a timeline; `--i` on each row staggers the card and
          the icon inside it from a single variable. */}
      <section className={SECTION} aria-labelledby="about-features">
        <h2 id="about-features" className={HEADING}>
          {about.featuresTitle}
        </h2>
        <p className={`mt-3 max-w-3xl ${BODY}`}>{about.featuresDescription}</p>
        <ul className="app-cascade app-art app-art--scroll mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {about.features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index] ?? IdCardIcon;
            return (
              <li
                key={feature}
                style={beat(index)}
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

      {/* The community sets the bar */}
      <section className={SECTION} aria-labelledby="about-community">
        <MediaSplit
          side="start"
          media={
            <Art>
              <CommunityLoopIllustration label={about.communityIllustrationLabel} />
            </Art>
          }
        >
          <h2 id="about-community" className={HEADING}>
            {about.communityTitle}
          </h2>
          <p className={`mt-3 ${BODY}`}>{about.communityText}</p>
          <ul className="app-cascade mt-6 grid gap-3">
            {about.communityPrinciples.map((principle, index) => (
              <li
                key={principle.title}
                style={beat(index)}
                className="border-l-2 border-[color:var(--brand-strong)] pl-4"
              >
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                  {principle.title}
                </h3>
                <p className="mt-1 text-sm leading-6 app-muted">{principle.text}</p>
              </li>
            ))}
          </ul>
        </MediaSplit>
      </section>

      {/* Built in the open */}
      <section className={SECTION} aria-labelledby="about-open-source">
        <MediaSplit
          side="end"
          aspect="aspect-16/9"
          media={
            <Art>
              <OpenBuildIllustration label={about.openSourceIllustrationLabel} />
            </Art>
          }
        >
          <div className="app-cascade">
            <h2 id="about-open-source" style={beat(0)} className={HEADING}>
              {about.openSourceTitle}
            </h2>
            <p style={beat(1)} className={`mt-3 ${BODY}`}>
              {about.openSourceText}
            </p>
          </div>
        </MediaSplit>
      </section>

      {/* Closing call to action */}
      <section className={SECTION}>
        <div className="app-cascade flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div style={beat(0)}>
            {/* Deliberately no `app-mark` here: the sweep needs a screenful of
                scroll after the phrase, and the closing section never gets one.
                Using it once, on the mission statement, also keeps it a moment
                rather than a motif. */}
            <h2 className={HEADING}>{about.ctaTitle}</h2>
            <p className={`mt-3 max-w-xl ${BODY}`}>{about.ctaText}</p>
          </div>
          <div style={beat(1)} className="flex flex-col gap-3 sm:shrink-0 sm:flex-row">
            <ButtonLink href={primaryCta.href} className="w-full sm:w-auto">
              {primaryCta.label}
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
