import {
  createDefaultProfileVisibility,
  profileVisibilityKeys,
  type ProfileVisibility,
  type ProfileVisibilityKey,
} from "@/lib/profile-sections";

export const profileFontPresets = [
  "modern",
  "editorial",
  "friendly",
  "technical",
] as const;

export const profileTextScales = ["sm", "md", "lg"] as const;

export const profileBackgroundModes = ["gradient", "image", "video"] as const;

export const profileCardStyles = ["soft", "glass", "outline"] as const;

export const profileHeroAlignments = ["left", "center"] as const;

export const profileSectionSizes = [
  "compact",
  "regular",
  "wide",
  "full",
] as const;

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
export type ProfileCardStyle = (typeof profileCardStyles)[number];
export type ProfileHeroAlignment = (typeof profileHeroAlignments)[number];
export type ProfileSectionSize = (typeof profileSectionSizes)[number];
export type ProfileSectionId = (typeof profileSectionIds)[number];

export type ProfilePresentation = {
  accentColor: string;
  surfaceColor: string;
  panelColor: string;
  textColor: string;
  mutedColor: string;
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
};

export type ProfileSettings = ProfileVisibility & {
  presentation: ProfilePresentation;
};

const defaultSectionOrder: ProfileSectionId[] = [...profileSectionIds];

function getDefaultSectionSize(sectionId: ProfileSectionId): ProfileSectionSize {
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
    fontPreset: "modern",
    textScale: "md",
    backgroundMode: "gradient",
    backgroundUrl: null,
    backgroundStoragePath: null,
    overlayStrength: 48,
    cardStyle: "glass",
    heroAlignment: "left",
    sectionOrder: defaultSectionOrder,
    sectionSizes: Object.fromEntries(
      profileSectionIds.map((sectionId) => [sectionId, getDefaultSectionSize(sectionId)]),
    ) as Record<ProfileSectionId, ProfileSectionSize>,
  };
}

export function normalizeSectionOrder(value: unknown): ProfileSectionId[] {
  if (!Array.isArray(value)) {
    return defaultSectionOrder;
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

  for (const sectionId of profileSectionIds) {
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
  };
}

export function createDefaultProfileSettings(): ProfileSettings {
  return {
    ...createDefaultProfileVisibility(),
    presentation: createDefaultProfilePresentation(),
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

  return settings;
}

export function getProfileFontStack(fontPreset: ProfileFontPreset) {
  switch (fontPreset) {
    case "editorial":
      return 'Georgia, Cambria, "Times New Roman", serif';
    case "friendly":
      return '"Trebuchet MS", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    case "technical":
      return '"Lucida Console", "Courier New", monospace';
    case "modern":
    default:
      return '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
  }
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
