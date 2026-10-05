import type { CSSProperties } from "react";
import { contrastRatio } from "@/lib/color-contrast";
import {
  createDefaultProfileVisibility,
  profileVisibilityKeys,
  type ProfileVisibility,
  type ProfileVisibilityKey,
} from "@/lib/profile-sections";

export const profileFontPresets = [
  "modern",
  "clean",
  "editorial",
  "friendly",
  "technical",
  "bold",
] as const;

export const profileTextScales = ["sm", "md", "lg"] as const;

export const profileBackgroundModes = [
  "gradient",
  "solid",
  "image",
  "video",
] as const;

// The section cards only support flat backgrounds (gradient/solid) — a photo or
// video repeated inside every card would be unreadable, so those modes are
// hero-only.
export const profileSectionBackgroundModes = ["gradient", "solid"] as const;

export const profileCardStyles = ["soft", "glass", "outline"] as const;

export const profileHeroAlignments = ["left", "center"] as const;

export const profileSectionSizes = [
  "compact",
  "regular",
  "wide",
  "full",
] as const;

/**
 * How the projects block lays out its cards:
 *  - grid: the standard card — cover, kind, title, a short description;
 *  - gallery: the cover is the card, with just the title under it (visual work);
 *  - cases: a wide card, cover beside a longer description (development, QA).
 */
export const profileProjectLayouts = ["grid", "gallery", "cases"] as const;

export const profileSectionIds = [
  "about",
  "professionalDetails",
  "workExperience",
  "skills",
  "languages",
  "education",
  "certificates",
  "qa",
  "contacts",
  "projects",
  "articles",
] as const;

export type ProfileFontPreset = (typeof profileFontPresets)[number];
export type ProfileTextScale = (typeof profileTextScales)[number];
export type ProfileBackgroundMode = (typeof profileBackgroundModes)[number];
export type ProfileSectionBackgroundMode =
  (typeof profileSectionBackgroundModes)[number];
export type ProfileCardStyle = (typeof profileCardStyles)[number];
export type ProfileHeroAlignment = (typeof profileHeroAlignments)[number];
export type ProfileSectionSize = (typeof profileSectionSizes)[number];
export type ProfileSectionId = (typeof profileSectionIds)[number];
export type ProfileProjectLayout = (typeof profileProjectLayouts)[number];

export type ProfilePresentation = {
  accentColor: string;
  surfaceColor: string;
  panelColor: string;
  textColor: string;
  mutedColor: string;
  // Dedicated background colours, kept separate from the role colours above so
  // tuning the hero/card/accent palette never changes the backdrop and vice versa.
  // The hero and the section cards each get their own independent backdrop.
  gradientFrom: string;
  gradientTo: string;
  solidColor: string;
  sectionBackgroundMode: ProfileSectionBackgroundMode;
  sectionGradientFrom: string;
  sectionGradientTo: string;
  sectionSolidColor: string;
  fontPreset: ProfileFontPreset;
  textScale: ProfileTextScale;
  backgroundMode: ProfileBackgroundMode;
  backgroundUrl: string | null;
  backgroundStoragePath: string | null;
  overlayStrength: number;
  cardStyle: ProfileCardStyle;
  heroAlignment: ProfileHeroAlignment;
  sectionOrder: ProfileSectionId[];
  sectionSizes: Record<ProfileSectionId, ProfileSectionSize>;
  projectLayout: ProfileProjectLayout;
};

// Viewer-side preferences: how *this* user experiences the profiles they
// browse, as opposed to how their own profile appears to others. Stored in the
// same profile_visibility JSONB so no extra column/migration is needed.
export type ViewerPreferences = {
  // When false, other people's profiles render with the platform defaults
  // (colours, fonts, card styles, layout) — only the hero photo/video is kept.
  showOthersCustomization: boolean;
};

export type ProfileSettings = ProfileVisibility & {
  presentation: ProfilePresentation;
  viewerPreferences: ViewerPreferences;
};

// The work comes first: a portfolio, not a CV. Pairs in the 12-column grid
// (about 8 + contacts 4, details 6 + experience 6, skills 4 + education 8)
// keep the rows full with the default sizes below.
const defaultSectionOrder: ProfileSectionId[] = [
  "projects",
  "about",
  "contacts",
  "professionalDetails",
  "workExperience",
  "skills",
  "education",
  "certificates",
  "languages",
  "qa",
  "articles",
];

// Until 05.10 the default was `profileSectionIds` as listed, with projects
// near the bottom. The editor saves the whole order on every save, so an order
// equal to that list means the author never moved a block — they get the new
// default. Any other order is the author's choice and stays.
const legacyDefaultSectionOrder: readonly ProfileSectionId[] = profileSectionIds;

export function getDefaultSectionSize(sectionId: ProfileSectionId): ProfileSectionSize {
  switch (sectionId) {
    case "contacts":
    case "skills":
    case "languages":
    case "qa":
      return "compact";
    case "professionalDetails":
    case "workExperience":
    case "certificates":
      return "regular";
    case "about":
    case "education":
      return "wide";
    case "projects":
    case "articles":
    default:
      return "full";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHexColor(value: string) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function normalizeColor(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return isHexColor(trimmed) ? trimmed.toLowerCase() : fallback;
}

function normalizeUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? candidate : null;
  } catch {
    return null;
  }
}

function normalizeEnumValue<T extends readonly string[]>(
  value: unknown,
  values: T,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && values.includes(value as T[number])
    ? (value as T[number])
    : fallback;
}

function normalizeOverlayStrength(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 48;
  }

  return Math.min(85, Math.max(0, Math.round(value)));
}

export function createDefaultProfilePresentation(): ProfilePresentation {
  return {
    accentColor: "#f97316",
    surfaceColor: "#0f172a",
    panelColor: "#111827",
    textColor: "#f8fafc",
    mutedColor: "#cbd5e1",
    gradientFrom: "#0f172a",
    gradientTo: "#312e81",
    solidColor: "#0f172a",
    sectionBackgroundMode: "gradient",
    sectionGradientFrom: "#111827",
    sectionGradientTo: "#1e293b",
    sectionSolidColor: "#111827",
    fontPreset: "modern",
    textScale: "md",
    backgroundMode: "gradient",
    backgroundUrl: null,
    backgroundStoragePath: null,
    overlayStrength: 48,
    cardStyle: "glass",
    heroAlignment: "left",
    sectionOrder: [...defaultSectionOrder],
    sectionSizes: Object.fromEntries(
      profileSectionIds.map((sectionId) => [sectionId, getDefaultSectionSize(sectionId)]),
    ) as Record<ProfileSectionId, ProfileSectionSize>,
    projectLayout: "grid",
  };
}

export function normalizeSectionOrder(value: unknown): ProfileSectionId[] {
  if (!Array.isArray(value)) {
    return [...defaultSectionOrder];
  }

  const collected: ProfileSectionId[] = [];

  for (const item of value) {
    if (
      typeof item === "string" &&
      profileSectionIds.includes(item as ProfileSectionId) &&
      !collected.includes(item as ProfileSectionId)
    ) {
      collected.push(item as ProfileSectionId);
    }
  }

  if (
    collected.length === legacyDefaultSectionOrder.length &&
    collected.every((sectionId, index) => sectionId === legacyDefaultSectionOrder[index])
  ) {
    return [...defaultSectionOrder];
  }

  for (const sectionId of defaultSectionOrder) {
    if (!collected.includes(sectionId)) {
      collected.push(sectionId);
    }
  }

  return collected;
}

export function normalizeProfilePresentation(value: unknown): ProfilePresentation {
  const defaults = createDefaultProfilePresentation();

  if (!isRecord(value)) {
    return defaults;
  }

  return {
    accentColor: normalizeColor(value.accentColor, defaults.accentColor),
    surfaceColor: normalizeColor(value.surfaceColor, defaults.surfaceColor),
    panelColor: normalizeColor(value.panelColor, defaults.panelColor),
    textColor: normalizeColor(value.textColor, defaults.textColor),
    mutedColor: normalizeColor(value.mutedColor, defaults.mutedColor),
    gradientFrom: normalizeColor(value.gradientFrom, defaults.gradientFrom),
    gradientTo: normalizeColor(value.gradientTo, defaults.gradientTo),
    solidColor: normalizeColor(value.solidColor, defaults.solidColor),
    sectionBackgroundMode: normalizeEnumValue(
      value.sectionBackgroundMode,
      profileSectionBackgroundModes,
      defaults.sectionBackgroundMode,
    ),
    sectionGradientFrom: normalizeColor(
      value.sectionGradientFrom,
      defaults.sectionGradientFrom,
    ),
    sectionGradientTo: normalizeColor(
      value.sectionGradientTo,
      defaults.sectionGradientTo,
    ),
    sectionSolidColor: normalizeColor(
      value.sectionSolidColor,
      defaults.sectionSolidColor,
    ),
    fontPreset: normalizeEnumValue(value.fontPreset, profileFontPresets, defaults.fontPreset),
    textScale: normalizeEnumValue(value.textScale, profileTextScales, defaults.textScale),
    backgroundMode: normalizeEnumValue(
      value.backgroundMode,
      profileBackgroundModes,
      defaults.backgroundMode,
    ),
    backgroundUrl: normalizeUrl(value.backgroundUrl),
    backgroundStoragePath:
      typeof value.backgroundStoragePath === "string" && value.backgroundStoragePath.trim()
        ? value.backgroundStoragePath.trim()
        : null,
    overlayStrength: normalizeOverlayStrength(value.overlayStrength),
    cardStyle: normalizeEnumValue(value.cardStyle, profileCardStyles, defaults.cardStyle),
    heroAlignment: normalizeEnumValue(
      value.heroAlignment,
      profileHeroAlignments,
      defaults.heroAlignment,
    ),
    sectionOrder: normalizeSectionOrder(value.sectionOrder),
    sectionSizes: profileSectionIds.reduce<Record<ProfileSectionId, ProfileSectionSize>>(
      (acc, sectionId) => {
        const source = isRecord(value.sectionSizes) ? value.sectionSizes[sectionId] : undefined;
        acc[sectionId] = normalizeEnumValue(
          source,
          profileSectionSizes,
          defaults.sectionSizes[sectionId],
        );
        return acc;
      },
      {} as Record<ProfileSectionId, ProfileSectionSize>,
    ),
    projectLayout: normalizeEnumValue(
      value.projectLayout,
      profileProjectLayouts,
      defaults.projectLayout,
    ),
  };
}

export function createDefaultViewerPreferences(): ViewerPreferences {
  return {
    showOthersCustomization: true,
  };
}

export function normalizeViewerPreferences(value: unknown): ViewerPreferences {
  const defaults = createDefaultViewerPreferences();

  if (!isRecord(value)) {
    return defaults;
  }

  return {
    showOthersCustomization:
      typeof value.showOthersCustomization === "boolean"
        ? value.showOthersCustomization
        : defaults.showOthersCustomization,
  };
}

export function createDefaultProfileSettings(): ProfileSettings {
  return {
    ...createDefaultProfileVisibility(),
    presentation: createDefaultProfilePresentation(),
    viewerPreferences: createDefaultViewerPreferences(),
  };
}

export function normalizeProfileSettings(value: unknown): ProfileSettings {
  const settings = createDefaultProfileSettings();

  if (!isRecord(value)) {
    return settings;
  }

  for (const key of profileVisibilityKeys) {
    const candidate = value[key];

    if (typeof candidate === "boolean") {
      settings[key as ProfileVisibilityKey] = candidate;
    }
  }

  settings.presentation = normalizeProfilePresentation(value.presentation);
  settings.viewerPreferences = normalizeViewerPreferences(value.viewerPreferences);

  return settings;
}

/**
 * Resolve the presentation a viewer should actually see for someone else's
 * profile. When the viewer has opted out of other people's customization, the
 * profile falls back to the platform defaults — colours, fonts, card style and
 * layout all reset — but the hero photo/video is preserved, since that is
 * content rather than styling. A hero that is only a gradient/solid colour
 * counts as styling and resets too.
 *
 * Callers must only neutralize when viewing *other* people's profiles; an owner
 * (and the editor preview) always sees their own customization in full.
 */
export function applyViewerCustomizationPreference(
  presentation: ProfilePresentation,
  showCustomization: boolean,
): ProfilePresentation {
  if (showCustomization) {
    return presentation;
  }

  const defaults = createDefaultProfilePresentation();
  const keepsHeroMedia =
    (presentation.backgroundMode === "image" ||
      presentation.backgroundMode === "video") &&
    Boolean(presentation.backgroundUrl);

  if (!keepsHeroMedia) {
    return defaults;
  }

  return {
    ...defaults,
    backgroundMode: presentation.backgroundMode,
    backgroundUrl: presentation.backgroundUrl,
    backgroundStoragePath: presentation.backgroundStoragePath,
  };
}

// The palette fields that decide whether a profile is still on the default
// look. Background media (hero photo/video), typography, text scale, hero
// alignment and section layout are intentionally excluded — they don't change
// whether the colour palette is "default".
export const profileThemePaletteFields = [
  "accentColor",
  "surfaceColor",
  "panelColor",
  "textColor",
  "mutedColor",
  "gradientFrom",
  "gradientTo",
  "solidColor",
  "sectionBackgroundMode",
  "sectionGradientFrom",
  "sectionGradientTo",
  "sectionSolidColor",
  "cardStyle",
] as const satisfies readonly (keyof ProfilePresentation)[];

/**
 * True when a profile's palette is still the platform default, i.e. the owner
 * hasn't picked custom colours or a card style (also the case for a viewer who
 * opted out of others' customization). Such profiles should follow the site's
 * light/dark theme rather than the baked-in dark default, so a default profile
 * reads light on the light theme and dark on the dark theme.
 */
export function isDefaultProfileTheme(
  presentation: ProfilePresentation,
): boolean {
  const defaults = createDefaultProfilePresentation();
  return profileThemePaletteFields.every(
    (field) => presentation[field] === defaults[field],
  );
}

const SANS_FALLBACK = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const MANROPE = `"Manrope", "Manrope Fallback", ${SANS_FALLBACK}`;
const ONEST = `"Onest", "Onest Fallback", ${SANS_FALLBACK}`;

/**
 * Real webfonts with Cyrillic, self-hosted: Manrope and JetBrains Mono come with
 * the site (fonts.css), the rest from profile-fonts.css, which only pages that
 * draw a profile in its author's style import. Headings get their own stack so
 * a preset can pair a display face with a calmer body face.
 */
export function getProfileFonts(fontPreset: ProfileFontPreset): {
  body: string;
  heading: string;
} {
  switch (fontPreset) {
    case "clean":
      return { body: ONEST, heading: ONEST };
    case "editorial": {
      const lora = '"Lora", "Lora Fallback", Georgia, "Times New Roman", serif';
      return { body: lora, heading: lora };
    }
    case "friendly": {
      const nunito = `"Nunito", "Nunito Fallback", "Trebuchet MS", ${SANS_FALLBACK}`;
      return { body: nunito, heading: nunito };
    }
    case "technical": {
      const mono =
        '"JetBrains Mono", "JetBrains Mono Fallback", Consolas, "Courier New", monospace';
      return { body: mono, heading: mono };
    }
    case "bold":
      return {
        body: ONEST,
        heading: `"Unbounded", "Unbounded Fallback", ${SANS_FALLBACK}`,
      };
    // The site's own pairing, so a profile nobody styled matches the rest of
    // the site (it is the default preset).
    case "modern":
    default:
      return {
        body: MANROPE,
        heading: '"Literata", "Literata Fallback", "Iowan Old Style", Georgia, serif',
      };
  }
}

export function getProfileFontStack(fontPreset: ProfileFontPreset) {
  return getProfileFonts(fontPreset).body;
}

/**
 * Inline style that puts a profile subtree on its preset: the body font, plus
 * the variables `font-display` and `font-sans` read, so headings and utility
 * classes inside follow the preset instead of the site fonts.
 */
export function getProfileFontStyle(
  fontPreset: ProfileFontPreset,
): CSSProperties & Record<`--${string}`, string> {
  const { body, heading } = getProfileFonts(fontPreset);
  return {
    fontFamily: body,
    "--font-body": body,
    "--font-display": heading,
  };
}

export function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : normalized;
  const parsed = Number.parseInt(value, 16);
  const r = Number.isNaN(parsed) ? 255 : (parsed >> 16) & 255;
  const g = Number.isNaN(parsed) ? 255 : (parsed >> 8) & 255;
  const b = Number.isNaN(parsed) ? 255 : parsed & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const PROFILE_DARK_LABEL = "#0b1120";
const PROFILE_LIGHT_LABEL = "#f8fafc";

/**
 * Pick a legible text colour (near-black or near-white) for content that sits
 * on top of `hex`. Used for accent-coloured controls (buttons, badges) so their
 * label stays readable regardless of which accent the owner picks — decoupled
 * from any background colour so tuning the backdrop never changes button text.
 */
export function getReadableTextColor(hex: string) {
  // Whichever of the two has the higher WCAG contrast on the accent. (A YIQ
  // brightness cut-off used to decide, and it put white on mid-tone accents
  // where dark text measured better.)
  return contrastRatio(PROFILE_DARK_LABEL, hex) >= contrastRatio(PROFILE_LIGHT_LABEL, hex)
    ? PROFILE_DARK_LABEL
    : PROFILE_LIGHT_LABEL;
}

/**
 * The hero "stage" background. The backdrop is controlled entirely by its own
 * dedicated colours (gradient pair / solid colour), independent of the
 * hero/card/accent role colours — so tuning the palette never disturbs the
 * background. Shared by the live profile and the editor preview so what the
 * user tunes is exactly what ships.
 *  - solid: a single flat colour
 *  - gradient (or any media mode without an uploaded URL): a two-colour gradient
 *  - image/video with a URL: the solid colour as a base; the media sits on top
 */
export function getProfileHeroBackground(presentation: ProfilePresentation) {
  if (presentation.backgroundMode === "solid") {
    return presentation.solidColor;
  }

  if (
    presentation.backgroundMode === "gradient" ||
    !presentation.backgroundUrl
  ) {
    return `linear-gradient(150deg, ${presentation.gradientFrom} 0%, ${presentation.gradientTo} 100%)`;
  }

  return presentation.solidColor;
}

/**
 * Translucent wash layered over a background image/video so hero text stays
 * legible. It is tinted only with the hero (surface) colour — never the
 * gradient pair — so choosing a photo doesn't drag in the gradient colours.
 * Surface is the natural choice: the text colour is already picked to contrast
 * with it, so the same contrast holds over the wash. Intensity follows the
 * overlay-strength slider; at 0 the photo shows through almost untouched.
 */
export function getProfileHeroOverlay(presentation: ProfilePresentation) {
  const strength = presentation.overlayStrength;
  const near = Math.min(0.92, strength / 90);
  const far = Math.min(0.55, strength / 170);
  return `linear-gradient(135deg, ${withAlpha(presentation.surfaceColor, near)} 0%, ${withAlpha(presentation.surfaceColor, far)} 100%)`;
}

/**
 * Backdrop fill for the section cards (everything below the hero), controlled by
 * its own dedicated colours so it stays independent of the hero background.
 * Either a two-colour gradient or a single flat colour. Pass an alpha to get a
 * translucent variant (used by the glass card style).
 */
export function getProfileSectionBackground(
  presentation: ProfilePresentation,
  alpha?: number,
) {
  if (presentation.sectionBackgroundMode === "solid") {
    return alpha === undefined
      ? presentation.sectionSolidColor
      : withAlpha(presentation.sectionSolidColor, alpha);
  }

  const from =
    alpha === undefined
      ? presentation.sectionGradientFrom
      : withAlpha(presentation.sectionGradientFrom, alpha);
  const to =
    alpha === undefined
      ? presentation.sectionGradientTo
      : withAlpha(presentation.sectionGradientTo, alpha);
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

/**
 * Full inline style for a section card. The card style is the *treatment* and
 * the section colours are the *fill*, so the two compose instead of fighting:
 *  - soft:    opaque fill + soft shadow + hairline border
 *  - glass:   translucent fill + backdrop blur (page shows through, frosted)
 *  - outline: no fill, just an accent border
 */
export function getProfileSectionCardStyle(
  presentation: ProfilePresentation,
): CSSProperties {
  switch (presentation.cardStyle) {
    case "glass":
      return {
        background: getProfileSectionBackground(presentation, 0.5),
        backdropFilter: "blur(16px) saturate(140%)",
        WebkitBackdropFilter: "blur(16px) saturate(140%)",
        border: `1px solid ${withAlpha("#ffffff", 0.16)}`,
      };
    case "outline":
      return {
        background: "transparent",
        border: `1px solid ${withAlpha(presentation.accentColor, 0.85)}`,
      };
    case "soft":
    default:
      return {
        background: getProfileSectionBackground(presentation),
        border: `1px solid ${withAlpha("#ffffff", 0.08)}`,
        boxShadow: `0 24px 70px ${withAlpha("#020617", 0.22)}`,
      };
  }
}

export function getProfileTextScale(textScale: ProfileTextScale) {
  switch (textScale) {
    case "sm":
      return {
        body: 0.96,
        heading: 0.96,
      };
    case "lg":
      return {
        body: 1.08,
        heading: 1.06,
      };
    case "md":
    default:
      return {
        body: 1,
        heading: 1,
      };
  }
}

/** Cards in the profile's projects grid, not counting the featured one. */
export const PROFILE_PROJECTS_GRID_LIMIT = 6;
/** Gallery cards are small: three full rows of three. */
export const PROFILE_GALLERY_GRID_LIMIT = 9;
/** Articles shown on the profile before "View all". */
export const PROFILE_ARTICLES_LIMIT = 3;

/**
 * Splits the profile's projects (pinned first, then newest) into the featured
 * card and the grid. The first project is featured only when the author pinned
 * it and the block is wide enough for a two-column card.
 */
export function pickProfileProjects<T extends { is_pinned?: boolean | null }>(
  projects: readonly T[],
  size: ProfileSectionSize,
  layout: ProfileProjectLayout = "grid",
): { featured: T | null; grid: T[] } {
  const roomForFeatured = size === "full" || size === "wide";
  const featured = roomForFeatured && projects[0]?.is_pinned ? projects[0] : null;
  const rest = featured ? projects.slice(1) : projects;
  const limit = layout === "gallery" ? PROFILE_GALLERY_GRID_LIMIT : PROFILE_PROJECTS_GRID_LIMIT;

  return { featured, grid: rest.slice(0, limit) };
}

/**
 * Grid columns for project and article cards, by the block's width. Gallery
 * cards keep two columns even on a phone; case cards are wide, so only a
 * full-width block puts two side by side.
 */
export function getProfileItemsGridClass(
  size: ProfileSectionSize,
  layout: ProfileProjectLayout = "grid",
): string {
  if (layout === "gallery") {
    switch (size) {
      case "full":
        return "grid-cols-2 lg:grid-cols-3";
      case "regular":
        return "grid-cols-2 lg:grid-cols-1 xl:grid-cols-2";
      case "compact":
        return "grid-cols-2 lg:grid-cols-1";
      case "wide":
      default:
        return "grid-cols-2";
    }
  }

  if (layout === "cases") {
    return size === "full" ? "xl:grid-cols-2" : "";
  }

  switch (size) {
    case "full":
      return "sm:grid-cols-2 xl:grid-cols-3";
    case "wide":
      return "sm:grid-cols-2";
    case "regular":
      return "sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2";
    case "compact":
    default:
      return "sm:grid-cols-2 lg:grid-cols-1";
  }
}