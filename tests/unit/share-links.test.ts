import { describe, expect, it } from "vitest";
import { buildFirstTouch } from "@/lib/first-touch";
import {
  displayUrl,
  isPortfolioPath,
  isShareTag,
  SHARE_TAG_MEDIUM,
  withShareTag,
} from "@/lib/share-links";

describe("withShareTag", () => {
  it("adds the UTM pair the first-touch tracker already reads", () => {
    const tagged = withShareTag("https://searchtalent.dev/u/olena.koval", "qr");
    expect(tagged).toBe(
      "https://searchtalent.dev/u/olena.koval?utm_source=qr&utm_medium=portfolio",
    );

    const touch = buildFirstTouch({ landingUrl: tagged, documentReferrer: "", now: 0 });
    expect(touch).toMatchObject({
      utmSource: "qr",
      utmMedium: SHARE_TAG_MEDIUM,
      landingPath: "/u/olena.koval",
    });
  });

  it("replaces tags instead of stacking them and keeps other parameters", () => {
    expect(
      withShareTag("https://searchtalent.dev/u/olena?utm_source=badge&tab=projects", "resume"),
    ).toBe("https://searchtalent.dev/u/olena?utm_source=resume&tab=projects&utm_medium=portfolio");
  });
});

describe("isShareTag", () => {
  it("knows only the share loop's own tags", () => {
    expect(isShareTag("badge")).toBe(true);
    expect(isShareTag("qr")).toBe(true);
    expect(isShareTag("resume")).toBe(true);
    expect(isShareTag("linkedin")).toBe(false);
    expect(isShareTag(null)).toBe(false);
  });
});

describe("displayUrl", () => {
  it("drops the scheme and a trailing slash", () => {
    expect(displayUrl("https://searchtalent.dev/u/olena/")).toBe("searchtalent.dev/u/olena");
    expect(displayUrl("http://localhost:3000/u/olena")).toBe("localhost:3000/u/olena");
  });
});

describe("isPortfolioPath", () => {
  it.each([
    "/u/olena",
    "/uk/u/olena",
    "/en/u/olena/projects",
    "/projects/landing-redesign",
    "/uk/projects/landing-redesign/discussion",
    "/u/olena?tab=about",
  ])("%s is a portfolio page", (path) => {
    expect(isPortfolioPath(path)).toBe(true);
  });

  it.each([
    null,
    "",
    "/",
    "/uk",
    "/u",
    "/uk/talents",
    "/projects",
    "/uk/projects/new",
    "/projects/edit/123",
    "/projects/tag/react",
    "/en/projects/type/video",
    "/articles/how-to-portfolio",
    "/de/u/olena",
  ])("%s is not", (path) => {
    expect(isPortfolioPath(path)).toBe(false);
  });
});
