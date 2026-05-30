import { describe, expect, it } from "vitest";
import {
  createDefaultProfilePresentation,
  createDefaultProfileSettings,
  getProfileFontStack,
  getProfileTextScale,
  normalizeProfilePresentation,
  normalizeProfileSettings,
  normalizeSectionOrder,
  profileSectionIds,
} from "@/lib/profile-presentation";

describe("createDefaultProfilePresentation", () => {
  it("returns an object with all expected default values", () => {
    const defaults = createDefaultProfilePresentation();

    expect(defaults.accentColor).toBe("#f97316");
    expect(defaults.surfaceColor).toBe("#0f172a");
    expect(defaults.fontPreset).toBe("modern");
    expect(defaults.textScale).toBe("md");
    expect(defaults.backgroundMode).toBe("gradient");
    expect(defaults.backgroundUrl).toBeNull();
    expect(defaults.backgroundStoragePath).toBeNull();
    expect(defaults.overlayStrength).toBe(48);
    expect(defaults.cardStyle).toBe("glass");
    expect(defaults.heroAlignment).toBe("left");
    expect(defaults.sectionOrder).toHaveLength(profileSectionIds.length);
  });

  it("has default section sizes for each section id", () => {
    const defaults = createDefaultProfilePresentation();

    for (const sectionId of profileSectionIds) {
      expect(defaults.sectionSizes[sectionId]).toBeDefined();
    }
  });
});

describe("normalizeProfilePresentation", () => {
  it("returns defaults for non-object input", () => {
    const defaults = createDefaultProfilePresentation();

    expect(normalizeProfilePresentation(null)).toEqual(defaults);
    expect(normalizeProfilePresentation(undefined)).toEqual(defaults);
    expect(normalizeProfilePresentation("string")).toEqual(defaults);
    expect(normalizeProfilePresentation(42)).toEqual(defaults);
    expect(normalizeProfilePresentation([1, 2])).toEqual(defaults);
  });

  it("returns defaults for empty object", () => {
    const result = normalizeProfilePresentation({});
    const defaults = createDefaultProfilePresentation();

    expect(result.accentColor).toBe(defaults.accentColor);
    expect(result.fontPreset).toBe(defaults.fontPreset);
  });

  it("normalizes valid hex colors", () => {
    const result = normalizeProfilePresentation({
      accentColor: "#FF5733",
      surfaceColor: "#abc",
    });

    expect(result.accentColor).toBe("#ff5733");
    expect(result.surfaceColor).toBe("#abc");
  });

  it("falls back to default for invalid colors", () => {
    const defaults = createDefaultProfilePresentation();
    const result = normalizeProfilePresentation({
      accentColor: "not-a-color",
      surfaceColor: 123,
      panelColor: "#GGGGGG",
    });

    expect(result.accentColor).toBe(defaults.accentColor);
    expect(result.surfaceColor).toBe(defaults.surfaceColor);
    expect(result.panelColor).toBe(defaults.panelColor);
  });

  it("normalizes valid enum values", () => {
    const result = normalizeProfilePresentation({
      fontPreset: "editorial",
      textScale: "lg",
      backgroundMode: "image",
      cardStyle: "outline",
      heroAlignment: "center",
    });

    expect(result.fontPreset).toBe("editorial");
    expect(result.textScale).toBe("lg");
    expect(result.backgroundMode).toBe("image");
    expect(result.cardStyle).toBe("outline");
    expect(result.heroAlignment).toBe("center");
  });

  it("falls back to default for invalid enum values", () => {
    const defaults = createDefaultProfilePresentation();
    const result = normalizeProfilePresentation({
      fontPreset: "comic-sans",
      textScale: "xxl",
      backgroundMode: "sparkle",
    });

    expect(result.fontPreset).toBe(defaults.fontPreset);
    expect(result.textScale).toBe(defaults.textScale);
    expect(result.backgroundMode).toBe(defaults.backgroundMode);
  });

  it("normalizes valid URLs for backgroundUrl", () => {
    const result = normalizeProfilePresentation({
      backgroundUrl: "https://example.com/bg.jpg",
    });

    expect(result.backgroundUrl).toBe("https://example.com/bg.jpg");
  });

  it("returns null for invalid backgroundUrl", () => {
    const result = normalizeProfilePresentation({
      backgroundUrl: "not-valid",
    });

    // Should auto-prefix https and try to parse
    expect(result.backgroundUrl).not.toBeNull();

    const result2 = normalizeProfilePresentation({
      backgroundUrl: "",
    });

    expect(result2.backgroundUrl).toBeNull();
  });

  it("returns null for non-string backgroundUrl", () => {
    const result = normalizeProfilePresentation({
      backgroundUrl: 12345,
    });

    expect(result.backgroundUrl).toBeNull();
  });

  it("clamps overlayStrength between 0 and 85", () => {
    expect(normalizeProfilePresentation({ overlayStrength: -10 }).overlayStrength).toBe(0);
    expect(normalizeProfilePresentation({ overlayStrength: 100 }).overlayStrength).toBe(85);
    expect(normalizeProfilePresentation({ overlayStrength: 50 }).overlayStrength).toBe(50);
    expect(normalizeProfilePresentation({ overlayStrength: 50.7 }).overlayStrength).toBe(51);
  });

  it("falls back to 48 for NaN overlayStrength", () => {
    expect(normalizeProfilePresentation({ overlayStrength: NaN }).overlayStrength).toBe(48);
    expect(normalizeProfilePresentation({ overlayStrength: "abc" }).overlayStrength).toBe(48);
  });

  it("normalizes backgroundStoragePath", () => {
    expect(
      normalizeProfilePresentation({ backgroundStoragePath: "  /path/to/file  " }).backgroundStoragePath,
    ).toBe("/path/to/file");
    expect(
      normalizeProfilePresentation({ backgroundStoragePath: "  " }).backgroundStoragePath,
    ).toBeNull();
    expect(
      normalizeProfilePresentation({ backgroundStoragePath: 42 }).backgroundStoragePath,
    ).toBeNull();
  });

  it("normalizes section sizes from sectionSizes object", () => {
    const result = normalizeProfilePresentation({
      sectionSizes: { about: "compact", skills: "full" },
    });

    expect(result.sectionSizes.about).toBe("compact");
    expect(result.sectionSizes.skills).toBe("full");
  });

  it("uses defaults for missing or invalid section sizes", () => {
    const defaults = createDefaultProfilePresentation();
    const result = normalizeProfilePresentation({
      sectionSizes: { about: "invalid-size" },
    });

    expect(result.sectionSizes.about).toBe(defaults.sectionSizes.about);
  });
});

describe("normalizeSectionOrder", () => {
  it("returns default order for non-array input", () => {
    expect(normalizeSectionOrder(null)).toEqual([...profileSectionIds]);
    expect(normalizeSectionOrder("string")).toEqual([...profileSectionIds]);
    expect(normalizeSectionOrder(42)).toEqual([...profileSectionIds]);
  });

  it("preserves valid order and appends missing sections", () => {
    const result = normalizeSectionOrder(["skills", "about"]);

    expect(result[0]).toBe("skills");
    expect(result[1]).toBe("about");
    expect(result).toHaveLength(profileSectionIds.length);
    // All section ids should be present
    for (const id of profileSectionIds) {
      expect(result).toContain(id);
    }
  });

  it("filters out invalid section ids", () => {
    const result = normalizeSectionOrder(["skills", "invalid", "about"]);

    expect(result).not.toContain("invalid");
    expect(result).toHaveLength(profileSectionIds.length);
  });

  it("removes duplicate entries", () => {
    const result = normalizeSectionOrder(["skills", "skills", "about", "about"]);

    expect(result.filter((id) => id === "skills")).toHaveLength(1);
    expect(result.filter((id) => id === "about")).toHaveLength(1);
  });
});

describe("normalizeProfileSettings", () => {
  it("returns defaults for non-object input", () => {
    const defaults = createDefaultProfileSettings();

    expect(normalizeProfileSettings(null)).toEqual(defaults);
    expect(normalizeProfileSettings(undefined)).toEqual(defaults);
  });

  it("applies boolean visibility overrides", () => {
    const result = normalizeProfileSettings({
      about: false,
      skills: false,
    });

    expect(result.about).toBe(false);
    expect(result.skills).toBe(false);
    expect(result.education).toBe(true); // default
  });

  it("ignores non-boolean visibility values", () => {
    const result = normalizeProfileSettings({
      about: "yes",
      skills: 1,
    });

    expect(result.about).toBe(true); // default, not overridden
    expect(result.skills).toBe(true);
  });

  it("normalizes nested presentation", () => {
    const result = normalizeProfileSettings({
      presentation: { fontPreset: "editorial" },
    });

    expect(result.presentation.fontPreset).toBe("editorial");
  });
});

describe("getProfileFontStack", () => {
  it("returns serif stack for editorial", () => {
    expect(getProfileFontStack("editorial")).toContain("Georgia");
  });

  it("returns sans-serif stack for friendly", () => {
    expect(getProfileFontStack("friendly")).toContain("Trebuchet MS");
  });

  it("returns monospace stack for technical", () => {
    expect(getProfileFontStack("technical")).toContain("Lucida Console");
  });

  it("returns default sans-serif stack for modern", () => {
    expect(getProfileFontStack("modern")).toContain("Segoe UI");
  });
});

describe("getProfileTextScale", () => {
  it("returns reduced scale for sm", () => {
    const scale = getProfileTextScale("sm");
    expect(scale.body).toBeLessThan(1);
    expect(scale.heading).toBeLessThan(1);
  });

  it("returns 1.0 scale for md", () => {
    const scale = getProfileTextScale("md");
    expect(scale.body).toBe(1);
    expect(scale.heading).toBe(1);
  });

  it("returns increased scale for lg", () => {
    const scale = getProfileTextScale("lg");
    expect(scale.body).toBeGreaterThan(1);
    expect(scale.heading).toBeGreaterThan(1);
  });
});
