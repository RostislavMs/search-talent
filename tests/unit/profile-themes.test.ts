import { describe, expect, it } from "vitest";
import {
  adjustColorUntil,
  contrastRatio,
  hslToHex,
  mixHexColors,
  relativeLuminance,
} from "@/lib/color-contrast";
import {
  createDefaultProfilePresentation,
  isDefaultProfileTheme,
  type ProfilePresentation,
} from "@/lib/profile-presentation";
import {
  applyProfileLook,
  checkProfileContrast,
  createRandomProfileLook,
  fixProfileContrast,
  getActiveProfileThemeId,
  getProfileAccentInk,
  getProfileTextBackdrops,
  getSiteProfileLook,
  PROFILE_TEXT_MIN_CONTRAST,
  profileThemes,
} from "@/lib/profile-themes";

/** Deterministic PRNG (mulberry32) so random looks are reproducible. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const base = createDefaultProfilePresentation();

describe("color-contrast", () => {
  it("measures the WCAG extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
    expect(relativeLuminance("#fff")).toBe(1);
  });

  it("mixes in sRGB", () => {
    expect(mixHexColors("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHexColors("#123456", "#ffffff", 0)).toBe("#123456");
  });

  it("builds colours from HSL", () => {
    expect(hslToHex(0, 100, 50)).toBe("#ff0000");
    expect(hslToHex(120, 100, 25)).toBe("#008000");
    expect(hslToHex(-120, 100, 50)).toBe("#0000ff");
    expect(hslToHex(200, 0, 50)).toBe("#808080");
  });

  it("returns the colour itself when it already passes", () => {
    expect(adjustColorUntil("#123456", () => true, () => 0)).toBe("#123456");
  });

  it("moves a colour only as far as it has to", () => {
    const fixed = adjustColorUntil(
      "#777777",
      (color) => contrastRatio(color, "#ffffff") >= 4.5,
      (color) => contrastRatio(color, "#ffffff"),
    );
    expect(contrastRatio(fixed, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fixed, "#ffffff")).toBeLessThan(6);
  });
});

describe("ready-made themes", () => {
  it.each(profileThemes.map((theme) => [theme.id, theme] as const))(
    "%s passes every contrast check",
    (_id, theme) => {
      const checks = checkProfileContrast(applyProfileLook(base, theme));
      expect(checks).toHaveLength(4);
      expect(checks.filter((check) => !check.passes)).toEqual([]);
    },
  );

  it.each(profileThemes.map((theme) => [theme.id, theme] as const))(
    "%s passes with a hero photo too",
    (_id, theme) => {
      const withPhoto: ProfilePresentation = {
        ...base,
        backgroundMode: "image",
        backgroundUrl: "https://cdn.example.com/hero.jpg",
      };
      const applied = applyProfileLook(withPhoto, theme);
      expect(checkProfileContrast(applied).every((check) => check.passes)).toBe(true);
    },
  );

  it("offers light and dark", () => {
    expect(profileThemes.some((theme) => theme.dark)).toBe(true);
    expect(profileThemes.some((theme) => !theme.dark)).toBe(true);
  });

  it("no theme is the site look in disguise", () => {
    for (const theme of profileThemes) {
      expect(isDefaultProfileTheme(applyProfileLook(base, theme))).toBe(false);
    }
  });
});

describe("applyProfileLook", () => {
  it("keeps the hero photo, layout and text size", () => {
    const presentation: ProfilePresentation = {
      ...base,
      backgroundMode: "video",
      backgroundUrl: "https://cdn.example.com/hero.mp4",
      backgroundStoragePath: "u/hero.mp4",
      textScale: "lg",
      heroAlignment: "center",
      sectionOrder: [...base.sectionOrder].reverse(),
    };
    const applied = applyProfileLook(presentation, profileThemes[0]);

    expect(applied.backgroundMode).toBe("video");
    expect(applied.backgroundUrl).toBe(presentation.backgroundUrl);
    expect(applied.backgroundStoragePath).toBe("u/hero.mp4");
    expect(applied.textScale).toBe("lg");
    expect(applied.heroAlignment).toBe("center");
    expect(applied.sectionOrder).toEqual(presentation.sectionOrder);
    expect(applied.accentColor).toBe(profileThemes[0].palette.accentColor);
    expect(applied.fontPreset).toBe(profileThemes[0].fontPreset);
  });

  it("uses the theme's hero backdrop when there is no media", () => {
    const mono = profileThemes.find((theme) => theme.id === "mono")!;
    expect(applyProfileLook(base, mono).backgroundMode).toBe("solid");
  });

  it("a photo mode without an uploaded file takes the theme's backdrop", () => {
    const presentation: ProfilePresentation = { ...base, backgroundMode: "image", backgroundUrl: null };
    expect(applyProfileLook(presentation, profileThemes[0]).backgroundMode).toBe("gradient");
  });
});

describe("getActiveProfileThemeId", () => {
  it("knows the site look", () => {
    expect(getActiveProfileThemeId(base)).toBe("site");
    expect(getActiveProfileThemeId(applyProfileLook(profileThemesApplied(), getSiteProfileLook()))).toBe("site");
  });

  it("recognises a theme even after the font changed", () => {
    const applied = { ...applyProfileLook(base, profileThemes[2]), fontPreset: "modern" as const };
    expect(getActiveProfileThemeId(applied)).toBe(profileThemes[2].id);
  });

  it("is null once a colour is the author's own", () => {
    const applied = { ...applyProfileLook(base, profileThemes[2]), accentColor: "#123456" };
    expect(getActiveProfileThemeId(applied)).toBeNull();
  });
});

function profileThemesApplied() {
  return applyProfileLook(base, profileThemes[3]);
}

describe("checkProfileContrast", () => {
  it("has nothing to say about the site look", () => {
    expect(checkProfileContrast(base)).toEqual([]);
  });

  it("catches grey text on a grey page", () => {
    const presentation: ProfilePresentation = {
      ...applyProfileLook(base, profileThemes[1]),
      textColor: "#bbbbbb",
      mutedColor: "#cccccc",
    };
    const failing = checkProfileContrast(presentation)
      .filter((check) => !check.passes)
      .map((check) => check.id);
    expect(failing).toEqual(expect.arrayContaining(["text", "muted"]));
  });

  it("checks text on the hero gradient, not only on the page", () => {
    const presentation: ProfilePresentation = {
      ...applyProfileLook(base, profileThemes[0]),
      backgroundMode: "gradient",
      gradientTo: "#1a1a1a",
    };
    const text = checkProfileContrast(presentation).find((check) => check.id === "text")!;
    expect(text.passes).toBe(false);
  });

  it("ignores the hero colours behind a photo", () => {
    const presentation: ProfilePresentation = {
      ...applyProfileLook(base, profileThemes[0]),
      backgroundMode: "image",
      backgroundUrl: "https://cdn.example.com/hero.jpg",
      gradientTo: "#1a1a1a",
    };
    expect(getProfileTextBackdrops(presentation)).not.toContain("#1a1a1a");
  });

  it("rounds the ratio down so a near miss never reads as a pass", () => {
    const check = checkProfileContrast({
      ...applyProfileLook(base, profileThemes[1]),
      mutedColor: "#777777",
    }).find((item) => item.id === "muted")!;
    expect(check.passes).toBe(false);
    expect(check.ratio).toBeLessThan(PROFILE_TEXT_MIN_CONTRAST);
  });
});

describe("fixProfileContrast", () => {
  it("makes a broken palette pass and leaves the backgrounds alone", () => {
    const broken: ProfilePresentation = {
      ...applyProfileLook(base, profileThemes[3]),
      textColor: "#3a2a24",
      mutedColor: "#4a3a34",
      accentColor: "#3b1d14",
    };
    const fixed = fixProfileContrast(broken);

    expect(checkProfileContrast(fixed).every((check) => check.passes)).toBe(true);
    expect(fixed.surfaceColor).toBe(broken.surfaceColor);
    expect(fixed.gradientTo).toBe(broken.gradientTo);
    expect(fixed.sectionGradientFrom).toBe(broken.sectionGradientFrom);
  });

  it("does not touch colours that already pass", () => {
    const theme = applyProfileLook(base, profileThemes[0]);
    expect(fixProfileContrast(theme)).toEqual(theme);
  });

  it("does not touch the site look", () => {
    expect(fixProfileContrast(base)).toBe(base);
  });
});

describe("getProfileAccentInk", () => {
  it("lightens the accent for text on a dark page", () => {
    const presentation: ProfilePresentation = {
      ...applyProfileLook(base, profileThemes[2]),
      accentColor: "#7c3aed",
    };
    const ink = getProfileAccentInk(presentation);
    for (const backdrop of getProfileTextBackdrops(presentation)) {
      expect(contrastRatio(ink, backdrop)).toBeGreaterThanOrEqual(PROFILE_TEXT_MIN_CONTRAST);
    }
    expect(relativeLuminance(ink)).toBeGreaterThan(relativeLuminance("#7c3aed"));
  });
});

describe("createRandomProfileLook", () => {
  it("always passes the contrast check", () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const look = createRandomProfileLook(seeded(seed));
      const failing = checkProfileContrast(applyProfileLook(base, look)).filter(
        (check) => !check.passes,
      );
      expect({ seed, failing }).toEqual({ seed, failing: [] });
    }
  });

  it("is reproducible from the random source", () => {
    expect(createRandomProfileLook(seeded(7))).toEqual(createRandomProfileLook(seeded(7)));
  });

  it("gives different looks on different rolls", () => {
    const accents = new Set(
      Array.from({ length: 20 }, (_, seed) => createRandomProfileLook(seeded(seed + 1)).palette.accentColor),
    );
    expect(accents.size).toBeGreaterThan(15);
  });
});
