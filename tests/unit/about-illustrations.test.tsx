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
});

describe("About copy", () => {
  // The page maps vignettes and icons onto these arrays by index, so a locale
  // that grows or loses an entry would silently draw the wrong picture.
  const EXPECTED = { pillars: 4, steps: 3, features: 6 } as const;

  it.each(locales)("%s has one entry per drawing", (locale) => {
    const about = getDictionary(locale).aboutPage;

    expect(about.pillars).toHaveLength(EXPECTED.pillars);
    expect(about.steps).toHaveLength(EXPECTED.steps);
    expect(about.features).toHaveLength(EXPECTED.features);
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
