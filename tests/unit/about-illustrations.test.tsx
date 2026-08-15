// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";

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
import { locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

afterEach(cleanup);

const ILLUSTRATIONS = [
  ["PlatformMapIllustration", PlatformMapIllustration],
  ["StepFlowIllustration", StepFlowIllustration],
  ["ScatteredToProfileIllustration", ScatteredToProfileIllustration],
  ["CommunityLoopIllustration", CommunityLoopIllustration],
  ["OpenBuildIllustration", OpenBuildIllustration],
  ["ProfileVignette", ProfileVignette],
  ["PortfolioVignette", PortfolioVignette],
  ["KnowledgeVignette", KnowledgeVignette],
  ["RecognitionVignette", RecognitionVignette],
] as const;

describe("About illustrations", () => {
  it.each(ILLUSTRATIONS)("%s exposes its label to assistive tech", (_name, Illustration) => {
    render(<Illustration label="described here" />);
    expect(screen.getByRole("img", { name: "described here" })).toBeInTheDocument();
  });

  it("draws colour from the theme tokens rather than hard-coded hexes", () => {
    // currentColor and the chart slots are what let one drawing work on the
    // light cards and on the dark hero. A literal hex would break one of them.
    const { container } = render(<PlatformMapIllustration label="x" />);
    const markup = container.innerHTML;

    expect(markup).toContain("currentColor");
    expect(markup).toContain("var(--chart-series-1)");
    expect(markup).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it.each(ILLUSTRATIONS)("%s normalises every animated stroke to pathLength 1", (_name, Illustration) => {
    // The motion kit gives `data-draw` / `data-flow` shapes a dash pattern
    // measured in path lengths (`stroke-dasharray: 1`). Without pathLength="1"
    // that is one *user unit*, so instead of drawing itself the shape renders
    // as a line of dots — and only in the browser, never in a type check.
    const { container } = render(<Illustration label="x" />);

    for (const shape of container.querySelectorAll("[data-draw], [data-flow]")) {
      expect(shape.getAttribute("pathLength")).toBe("1");
    }
  });

  it("keeps the drawing complete when nothing animates", () => {
    // Reduced motion, an old browser, an unresolved timeline: in every one of
    // those the animation never runs, so the *static* markup has to be the
    // finished drawing. A stroke-dashoffset baked into the SVG would leave the
    // page blank for those readers.
    const { container } = render(<PlatformMapIllustration label="x" />);

    expect(container.querySelector("[stroke-dashoffset]")).toBeNull();
  });
});

describe("About copy", () => {
  // The page maps vignettes, icons and figures onto these arrays by index, so a
  // locale that grows or loses an entry would silently draw the wrong picture —
  // or label the wrong number.
  const EXPECTED = {
    pillars: 4,
    steps: 3,
    features: 6,
    heroPoints: 3,
    communityPrinciples: 3,
  } as const;

  it.each(locales)("%s has one entry per drawing", (locale) => {
    const about = getDictionary(locale).aboutPage;

    expect(about.pillars).toHaveLength(EXPECTED.pillars);
    expect(about.steps).toHaveLength(EXPECTED.steps);
    expect(about.features).toHaveLength(EXPECTED.features);
    expect(about.heroPoints).toHaveLength(EXPECTED.heroPoints);
    expect(about.communityPrinciples).toHaveLength(EXPECTED.communityPrinciples);
  });

  it.each(locales)("%s offers a signed-in reader a different first step", (locale) => {
    // "Create your profile" is a dead end for someone who already has one, so
    // the page swaps in a second primary label rather than dropping the CTA.
    const about = getDictionary(locale).aboutPage;

    expect(about.ctaPrimaryAuthed.trim().length).toBeGreaterThan(0);
    expect(about.ctaPrimaryAuthed).not.toBe(about.ctaPrimary);
  });

  it.each(locales)("%s splits the mission lead around the marked phrase", (locale) => {
    // The marker sweep needs the claim isolated in its own span, so the lead
    // ships in two pieces. The first has to keep its trailing space (nothing
    // else separates the halves) and the second has to carry the full stop —
    // punctuation left outside the span shows up as a gap after the marker.
    const about = getDictionary(locale).aboutPage;

    expect(about.missionLeadBefore.trim().length).toBeGreaterThan(10);
    expect(about.missionLeadMark.trim().length).toBeGreaterThan(10);
    expect(about.missionLeadBefore.endsWith(" ")).toBe(true);
    expect(about.missionLeadMark.endsWith(".")).toBe(true);
  });

  it.each(locales)("%s labels every illustration", (locale) => {
    const about = getDictionary(locale).aboutPage;

    for (const label of [
      about.heroIllustrationLabel,
      about.stepsIllustrationLabel,
      about.missionIllustrationLabel,
      about.communityIllustrationLabel,
      about.openSourceIllustrationLabel,
      ...about.pillars.map((pillar) => pillar.illustrationLabel),
    ]) {
      expect(label.trim().length).toBeGreaterThan(10);
    }
  });
});
