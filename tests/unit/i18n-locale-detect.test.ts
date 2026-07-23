import { describe, expect, it } from "vitest";
import { detectPreferredLocale, xDefaultLocale } from "@/lib/i18n/config";

describe("detectPreferredLocale", () => {
  it("falls back to the x-default (English) when no Accept-Language is sent", () => {
    // Header-less clients are crawlers and social-preview bots. They must land
    // on the same locale the hreflang x-default advertises, or a shared cache
    // can pin the wrong locale for everyone.
    expect(detectPreferredLocale(null)).toBe(xDefaultLocale);
    expect(detectPreferredLocale("")).toBe(xDefaultLocale);
    expect(xDefaultLocale).toBe("en");
  });

  it("returns Ukrainian when the language subtag is uk", () => {
    expect(detectPreferredLocale("uk")).toBe("uk");
    expect(detectPreferredLocale("uk-UA,uk;q=0.9,en;q=0.8")).toBe("uk");
    // Ukrainian listed as a secondary preference still counts (Ukraine-focused).
    expect(detectPreferredLocale("en-US,en;q=0.9,uk;q=0.5")).toBe("uk");
  });

  it("returns English for languages other than Ukrainian", () => {
    expect(detectPreferredLocale("en-US,en;q=0.9")).toBe("en");
    expect(detectPreferredLocale("de-DE,de;q=0.9")).toBe("en");
    expect(detectPreferredLocale("ru-RU,ru;q=0.9")).toBe("en");
  });

  it("does not treat the en-UK region as Ukrainian", () => {
    // `en-UK` is a common mis-spelling of `en-GB`; the old substring check
    // matched the "uk" in it and mislabelled British English as Ukrainian.
    expect(detectPreferredLocale("en-UK,en;q=0.9")).toBe("en");
    expect(detectPreferredLocale("en-uk")).toBe("en");
  });
});
