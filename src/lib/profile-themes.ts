import {
  adjustColorUntil,
  compositeHexColor,
  contrastRatio,
  hslToHex,
  minContrast,
} from "@/lib/color-contrast";
import {
  createDefaultProfilePresentation,
  getReadableTextColor,
  isDefaultProfileTheme,
  profileCardStyles,
  profileFontPresets,
  profileThemePaletteFields,
  type ProfileFontPreset,
  type ProfilePresentation,
} from "@/lib/profile-presentation";

// ---------------------------------------------------------------------------
// Ready-made looks for a profile, the contrast check behind them, and the
// "random theme" button. A theme is a set of the existing presentation fields
// (palette, card style, hero backdrop, font), so applying one is a plain merge:
// nothing new is stored, and "Customise by hand" keeps working on top of it.
// ---------------------------------------------------------------------------

/** Body text and secondary text: WCAG AA for normal-size text. */
export const PROFILE_TEXT_MIN_CONTRAST = 4.5;
/** The accent as a fill or bar (buttons, borders): WCAG AA for UI parts. */
export const PROFILE_ACCENT_MIN_CONTRAST = 3;

export type ProfileThemePalette = Pick<
  ProfilePresentation,
  (typeof profileThemePaletteFields)[number]
>;

export type ProfileThemeLook = {
  palette: ProfileThemePalette;
  /** Used only while the hero has no photo or video of its own. */
  backgroundMode: "gradient" | "solid";
  fontPreset: ProfileFontPreset;
};

export const profileThemeIds = ["paper", "mono", "graphite", "ember", "deep"] as const;
export type ProfileThemeId = (typeof profileThemeIds)[number];

export type ProfileTheme = ProfileThemeLook & { id: ProfileThemeId; dark: boolean };

/**
 * Light and dark, warm and neutral. Every one passes `checkProfileContrast`
 * (pinned by a unit test), so one click never produces an unreadable page.
 */
export const profileThemes: readonly ProfileTheme[] = [
  {
    id: "paper",
    dark: false,
    fontPreset: "editorial",
    backgroundMode: "gradient",
    palette: {
      accentColor: "#b4441c",
      surfaceColor: "#f6f1ea",
      panelColor: "#fffdf9",
      textColor: "#1f1a16",
      mutedColor: "#5b5149",
      gradientFrom: "#efe3d3",
      gradientTo: "#e5d0b8",
      solidColor: "#efe3d3",
      sectionBackgroundMode: "solid",
      sectionGradientFrom: "#fffdf9",
      sectionGradientTo: "#f8f1e8",
      sectionSolidColor: "#fffdf9",
      cardStyle: "soft",
    },
  },
  {
    id: "mono",
    dark: false,
    fontPreset: "clean",
    backgroundMode: "solid",
    palette: {
      accentColor: "#18181b",
      surfaceColor: "#ffffff",
      panelColor: "#f4f4f5",
      textColor: "#18181b",
      mutedColor: "#52525b",
      gradientFrom: "#f4f4f5",
      gradientTo: "#e4e4e7",
      solidColor: "#f4f4f5",
      sectionBackgroundMode: "solid",
      sectionGradientFrom: "#ffffff",
      sectionGradientTo: "#f4f4f5",
      sectionSolidColor: "#ffffff",
      cardStyle: "outline",
    },
  },
  {
    id: "graphite",
    dark: true,
    fontPreset: "technical",
    backgroundMode: "gradient",
    palette: {
      accentColor: "#f5b942",
      surfaceColor: "#141518",
      panelColor: "#1f2024",
      textColor: "#f2f2f3",
      mutedColor: "#a6a7ae",
      gradientFrom: "#1d1e22",
      gradientTo: "#2c2d33",
      solidColor: "#1d1e22",
      sectionBackgroundMode: "solid",
      sectionGradientFrom: "#1a1b1f",
      sectionGradientTo: "#222328",
      sectionSolidColor: "#1a1b1f",
      cardStyle: "soft",
    },
  },
  {
    id: "ember",
    dark: true,
    fontPreset: "bold",
    backgroundMode: "gradient",
    palette: {
      accentColor: "#f08a5d",
      surfaceColor: "#1b1311",
      panelColor: "#2a1d19",
      textColor: "#f8ede6",
      mutedColor: "#cdb8ac",
      gradientFrom: "#2b1914",
      gradientTo: "#5c2b1b",
      solidColor: "#2b1914",
      sectionBackgroundMode: "gradient",
      sectionGradientFrom: "#231915",
      sectionGradientTo: "#2c1f1a",
      sectionSolidColor: "#231915",
      cardStyle: "soft",
    },
  },
  {
    id: "deep",
    dark: true,
    fontPreset: "friendly",
    backgroundMode: "gradient",
    palette: {
      accentColor: "#5fd4c4",
      surfaceColor: "#0b1424",
      panelColor: "#14223a",
      textColor: "#eef4fb",
      mutedColor: "#a3b5cc",
      gradientFrom: "#0f1d35",
      gradientTo: "#1f3f73",
      solidColor: "#0f1d35",
      sectionBackgroundMode: "gradient",
      sectionGradientFrom: "#13223b",
      sectionGradientTo: "#18294a",
      sectionSolidColor: "#13223b",
      cardStyle: "glass",
    },
  },
];

function pickPalette(presentation: ProfilePresentation): ProfileThemePalette {
  return Object.fromEntries(
    profileThemePaletteFields.map((field) => [field, presentation[field]]),
  ) as ProfileThemePalette;
}

/** The platform look: follows the site's light/dark theme. */
export function getSiteProfileLook(): ProfileThemeLook {
  const defaults = createDefaultProfilePresentation();
  return {
    palette: pickPalette(defaults),
    backgroundMode: "gradient",
    fontPreset: defaults.fontPreset,
  };
}

/**
 * Put a look on a profile. Only styling changes: a hero photo or video stays
 * (it is the author's content), and so do the layout, text size and alignment.
 */
export function applyProfileLook(
  presentation: ProfilePresentation,
  look: ProfileThemeLook,
): ProfilePresentation {
  const keepsHeroMedia =
    (presentation.backgroundMode === "image" || presentation.backgroundMode === "video") &&
    Boolean(presentation.backgroundUrl);

  return {
    ...presentation,
    ...look.palette,
    fontPreset: look.fontPreset,
    backgroundMode: keepsHeroMedia ? presentation.backgroundMode : look.backgroundMode,
  };
}

/** "site", a theme id, or null when the author has their own palette. */
export function getActiveProfileThemeId(
  presentation: ProfilePresentation,
): ProfileThemeId | "site" | null {
  if (isDefaultProfileTheme(presentation)) {
    return "site";
  }

  const theme = profileThemes.find((candidate) =>
    profileThemePaletteFields.every(
      (field) => candidate.palette[field] === presentation[field],
    ),
  );

  return theme?.id ?? null;
}

// --- Contrast ---------------------------------------------------------------

function unique(colors: string[]) {
  return [...new Set(colors)];
}

function getHeroFills(presentation: ProfilePresentation): string[] {
  if (presentation.backgroundMode === "solid") {
    return [presentation.solidColor];
  }
  // A photo or video sits under a wash of the page colour; its pixels can't be
  // checked here, and the page colour itself is checked anyway.
  if (
    (presentation.backgroundMode === "image" || presentation.backgroundMode === "video") &&
    presentation.backgroundUrl
  ) {
    return [];
  }
  return [presentation.gradientFrom, presentation.gradientTo];
}

/** What the section cards look like on the page, per card style. */
function getSectionFills(presentation: ProfilePresentation): string[] {
  const fills =
    presentation.sectionBackgroundMode === "solid"
      ? [presentation.sectionSolidColor]
      : [presentation.sectionGradientFrom, presentation.sectionGradientTo];

  switch (presentation.cardStyle) {
    case "outline":
      return [presentation.surfaceColor];
    case "glass":
      return fills.map((fill) => compositeHexColor(fill, 0.5, presentation.surfaceColor));
    case "soft":
    default:
      return fills;
  }
}

/** Nested blocks inside the sections (experience, contacts, chips). */
function getPanelFills(presentation: ProfilePresentation, sections: string[]): string[] {
  return presentation.cardStyle === "glass"
    ? sections.map((section) => compositeHexColor("#ffffff", 0.1, section))
    : [presentation.panelColor];
}

/** Every opaque colour body text can land on. */
export function getProfileTextBackdrops(presentation: ProfilePresentation): string[] {
  const sections = getSectionFills(presentation);
  return unique([
    presentation.surfaceColor,
    ...getHeroFills(presentation),
    ...sections,
    ...getPanelFills(presentation, sections),
  ]);
}

/** Where the accent is used as a fill or a bar. */
export function getProfileAccentBackdrops(presentation: ProfilePresentation): string[] {
  return unique([
    presentation.surfaceColor,
    ...getHeroFills(presentation),
    ...getSectionFills(presentation),
  ]);
}

export type ProfileContrastCheckId = "text" | "muted" | "accent" | "accentLabel";

export type ProfileContrastCheck = {
  id: ProfileContrastCheckId;
  /** Rounded down to one decimal, so 4.49 never reads as a passing "4.5". */
  ratio: number;
  min: number;
  passes: boolean;
};

function accentLabelContrast(accent: string) {
  return contrastRatio(getReadableTextColor(accent), accent);
}

function toCheck(id: ProfileContrastCheckId, ratio: number, min: number): ProfileContrastCheck {
  return { id, ratio: Math.floor(ratio * 10) / 10, min, passes: ratio >= min };
}

/**
 * The four things that make a page unreadable. Empty for the site look: it
 * follows the site theme, whose colours are checked in globals.css.
 */
export function checkProfileContrast(
  presentation: ProfilePresentation,
): ProfileContrastCheck[] {
  if (isDefaultProfileTheme(presentation)) {
    return [];
  }

  const textBackdrops = getProfileTextBackdrops(presentation);
  const accentBackdrops = getProfileAccentBackdrops(presentation);

  return [
    toCheck("text", minContrast(presentation.textColor, textBackdrops), PROFILE_TEXT_MIN_CONTRAST),
    toCheck("muted", minContrast(presentation.mutedColor, textBackdrops), PROFILE_TEXT_MIN_CONTRAST),
    toCheck(
      "accent",
      minContrast(presentation.accentColor, accentBackdrops),
      PROFILE_ACCENT_MIN_CONTRAST,
    ),
    toCheck(
      "accentLabel",
      accentLabelContrast(presentation.accentColor),
      PROFILE_TEXT_MIN_CONTRAST,
    ),
  ];
}

/**
 * The "Fix" button: nudges the text, secondary text and accent towards white or
 * black just far enough to pass, keeping their hue. Backgrounds are never
 * touched — they carry the look. When the backgrounds themselves are part light
 * and part dark, no single text colour can pass on all of them; the closest one
 * is used and the check keeps saying so.
 */
export function fixProfileContrast(presentation: ProfilePresentation): ProfilePresentation {
  if (isDefaultProfileTheme(presentation)) {
    return presentation;
  }

  const textBackdrops = getProfileTextBackdrops(presentation);
  const accentBackdrops = getProfileAccentBackdrops(presentation);
  const readable = (color: string) =>
    minContrast(color, textBackdrops) >= PROFILE_TEXT_MIN_CONTRAST;
  const readability = (color: string) => minContrast(color, textBackdrops);

  return {
    ...presentation,
    textColor: adjustColorUntil(presentation.textColor, readable, readability),
    mutedColor: adjustColorUntil(presentation.mutedColor, readable, readability),
    accentColor: adjustColorUntil(
      presentation.accentColor,
      (color) =>
        minContrast(color, accentBackdrops) >= PROFILE_ACCENT_MIN_CONTRAST &&
        accentLabelContrast(color) >= PROFILE_TEXT_MIN_CONTRAST,
      (color) =>
        Math.min(
          minContrast(color, accentBackdrops) / PROFILE_ACCENT_MIN_CONTRAST,
          accentLabelContrast(color) / PROFILE_TEXT_MIN_CONTRAST,
        ),
    ),
  };
}

/**
 * The accent as *text* (links, "View all"): the accent pushed just far enough
 * to read like body text on every backdrop. A fixed darkening of the accent
 * used to stand in, and on dark themes it made links darker than the page.
 */
export function getProfileAccentInk(presentation: ProfilePresentation): string {
  const backdrops = getProfileTextBackdrops(presentation);
  return adjustColorUntil(
    presentation.accentColor,
    (color) => minContrast(color, backdrops) >= PROFILE_TEXT_MIN_CONTRAST,
    (color) => minContrast(color, backdrops),
  );
}

// --- Random theme -----------------------------------------------------------

type Random = () => number;

function between(random: Random, min: number, max: number) {
  return min + (max - min) * random();
}

function pick<T>(random: Random, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

// Accent offsets from the base hue: same family, neighbours, or the opposite
// side of the wheel — the classic harmonious pairings.
const ACCENT_HUE_OFFSETS = [0, 30, -30, 150, 180, 210] as const;

/**
 * A harmonious palette plus a font, built from one base hue: the page, cards
 * and hero share it, the accent follows a classic pairing. Every colour pair is
 * then run through `fixProfileContrast`, so the result always passes — the
 * check is applied, not hoped for.
 */
export function createRandomProfileLook(random: Random = Math.random): ProfileThemeLook {
  const hue = between(random, 0, 360);
  const accentHue = hue + pick(random, ACCENT_HUE_OFFSETS);
  const dark = random() < 0.5;
  const saturation = between(random, 14, 34);
  const sectionBackgroundMode = pick(random, ["gradient", "solid"] as const);
  const cardStyle = pick(random, profileCardStyles);
  const fontPreset = pick(random, profileFontPresets);
  const backgroundMode = pick(random, ["gradient", "gradient", "solid"] as const);

  const palette: ProfileThemePalette = dark
    ? (() => {
        const base = between(random, 6, 10);
        return {
          accentColor: hslToHex(accentHue, between(random, 65, 85), between(random, 58, 68)),
          surfaceColor: hslToHex(hue, saturation, base),
          panelColor: hslToHex(hue, saturation, base + 7),
          textColor: hslToHex(hue, 20, 95),
          mutedColor: hslToHex(hue, 14, 74),
          gradientFrom: hslToHex(hue, saturation + 8, base + 4),
          gradientTo: hslToHex(accentHue, 42, 22),
          solidColor: hslToHex(hue, saturation + 8, base + 4),
          sectionBackgroundMode,
          sectionGradientFrom: hslToHex(hue, saturation, base + 4),
          sectionGradientTo: hslToHex(hue + 15, saturation, base + 8),
          sectionSolidColor: hslToHex(hue, saturation, base + 4),
          cardStyle,
        };
      })()
    : (() => {
        const base = between(random, 95, 97);
        return {
          accentColor: hslToHex(accentHue, between(random, 60, 80), between(random, 34, 42)),
          surfaceColor: hslToHex(hue, saturation + 10, base),
          panelColor: hslToHex(hue, saturation + 10, 99),
          textColor: hslToHex(hue, 30, 11),
          mutedColor: hslToHex(hue, 14, 35),
          gradientFrom: hslToHex(hue, 40, 90),
          gradientTo: hslToHex(accentHue, 45, 84),
          solidColor: hslToHex(hue, 40, 90),
          sectionBackgroundMode,
          sectionGradientFrom: hslToHex(hue, 30, 99),
          sectionGradientTo: hslToHex(hue + 15, 30, 96),
          sectionSolidColor: hslToHex(hue, 30, 99),
          cardStyle,
        };
      })();

  // Check the look as it will actually be drawn: with a gradient or solid hero.
  const drawn = fixProfileContrast(
    applyProfileLook(
      { ...createDefaultProfilePresentation(), backgroundUrl: null },
      { palette, backgroundMode, fontPreset },
    ),
  );

  return { palette: pickPalette(drawn), backgroundMode, fontPreset };
}
