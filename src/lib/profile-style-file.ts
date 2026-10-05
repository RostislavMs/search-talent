import {
  normalizeSectionOrder,
  profileBackgroundModes,
  profileCardStyles,
  profileFontPresets,
  profileHeroAlignments,
  profileProjectLayouts,
  profileSectionBackgroundModes,
  profileSectionIds,
  profileSectionSizes,
  profileTextScales,
  type ProfilePresentation,
  type ProfileSectionId,
  type ProfileSectionSize,
} from "@/lib/profile-presentation";

// ---------------------------------------------------------------------------
// The profile look as a file: download it, keep it, hand it to someone, apply
// it later. Only how the page looks travels — colours, font, text size, cards,
// block order and widths, project cards. The hero photo or video (files) and
// everything the page says (texts, contacts, which blocks are shown) stay out.
// ---------------------------------------------------------------------------

export const PROFILE_STYLE_FILE_TYPE = "searchtalent/profile-style";
export const PROFILE_STYLE_FILE_VERSION = 1;
export const PROFILE_STYLE_FILE_NAME = "searchtalent-profile-style.json";
/** A real file is about 1.5 KB; anything near this is not one of ours. */
export const PROFILE_STYLE_FILE_MAX_BYTES = 16 * 1024;

export type ProfileStyle = Omit<ProfilePresentation, "backgroundUrl" | "backgroundStoragePath">;

/** What a file sets: any of the fields, and widths for some of the blocks. */
export type ProfileStylePatch = Partial<Omit<ProfileStyle, "sectionSizes">> & {
  sectionSizes?: Partial<Record<ProfileSectionId, ProfileSectionSize>>;
};

const colorFields = [
  "accentColor",
  "surfaceColor",
  "panelColor",
  "textColor",
  "mutedColor",
  "gradientFrom",
  "gradientTo",
  "solidColor",
  "sectionGradientFrom",
  "sectionGradientTo",
  "sectionSolidColor",
] as const satisfies readonly (keyof ProfileStyle)[];

const enumFields = {
  sectionBackgroundMode: profileSectionBackgroundModes,
  fontPreset: profileFontPresets,
  textScale: profileTextScales,
  backgroundMode: profileBackgroundModes,
  cardStyle: profileCardStyles,
  heroAlignment: profileHeroAlignments,
  projectLayout: profileProjectLayouts,
} as const satisfies Partial<Record<keyof ProfileStyle, readonly string[]>>;

/** Every field the file carries, in the order it is written. */
export const profileStyleFields = [
  ...colorFields,
  ...(Object.keys(enumFields) as (keyof typeof enumFields)[]),
  "overlayStrength",
  "sectionOrder",
  "sectionSizes",
] as const satisfies readonly (keyof ProfileStyle)[];

export type ProfileStyleFile = {
  type: typeof PROFILE_STYLE_FILE_TYPE;
  version: typeof PROFILE_STYLE_FILE_VERSION;
  exportedAt: string;
  style: ProfileStyle;
};

export function createProfileStyleFile(
  presentation: ProfilePresentation,
  now: Date = new Date(),
): string {
  const style = Object.fromEntries(
    profileStyleFields.map((field) => [field, presentation[field]]),
  ) as ProfileStyle;
  const file: ProfileStyleFile = {
    type: PROFILE_STYLE_FILE_TYPE,
    version: PROFILE_STYLE_FILE_VERSION,
    exportedAt: now.toISOString(),
    style,
  };

  return `${JSON.stringify(file, null, 2)}\n`;
}

export type ProfileStyleFileError =
  | "tooLarge"
  | "notJson"
  | "notStyle"
  | "newerVersion"
  | "empty";

export type ProfileStyleParseResult =
  | {
      ok: true;
      style: ProfileStylePatch;
      /** Fields the file had but with values we can't use; they stay as they are. */
      skipped: number;
    }
  | { ok: false; error: ProfileStyleFileError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readColor(value: unknown): string | undefined {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
    ? value.trim().toLowerCase()
    : undefined;
}

function readEnum<T extends readonly string[]>(value: unknown, values: T): T[number] | undefined {
  return typeof value === "string" && (values as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}

function readOverlay(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 85
    ? Math.round(value)
    : undefined;
}

/** Known blocks in the file's order; the rest are added by the usual rules. */
function readSectionOrder(value: unknown): ProfileSectionId[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const known = value.filter(
    (item): item is ProfileSectionId =>
      typeof item === "string" && profileSectionIds.includes(item as ProfileSectionId),
  );

  return known.length > 0 ? normalizeSectionOrder(known) : undefined;
}

/** Widths for the blocks the file names; a block it leaves out keeps its own. */
function readSectionSizes(
  value: unknown,
): Partial<Record<ProfileSectionId, ProfileSectionSize>> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const sizes: Partial<Record<ProfileSectionId, ProfileSectionSize>> = {};

  for (const sectionId of profileSectionIds) {
    const size = readEnum(value[sectionId], profileSectionSizes);

    if (size) {
      sizes[sectionId] = size;
    }
  }

  return Object.keys(sizes).length > 0 ? sizes : undefined;
}

function byteLength(text: string) {
  return new TextEncoder().encode(text).length;
}

/**
 * Reads a file made by `createProfileStyleFile` (or edited by hand). A value
 * that doesn't fit is skipped, not guessed at: that field stays as it is, and
 * the count tells the author something was left out. Unknown fields — a hero
 * photo URL someone added, say — are ignored.
 */
export function parseProfileStyleFile(text: string): ProfileStyleParseResult {
  if (byteLength(text) > PROFILE_STYLE_FILE_MAX_BYTES) {
    return { ok: false, error: "tooLarge" };
  }

  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "notJson" };
  }

  if (!isRecord(data) || data.type !== PROFILE_STYLE_FILE_TYPE || !isRecord(data.style)) {
    return { ok: false, error: "notStyle" };
  }

  if (typeof data.version !== "number" || !Number.isInteger(data.version) || data.version < 1) {
    return { ok: false, error: "notStyle" };
  }

  if (data.version > PROFILE_STYLE_FILE_VERSION) {
    return { ok: false, error: "newerVersion" };
  }

  const source = data.style;
  const style: Record<string, unknown> = {};
  let skipped = 0;

  for (const field of profileStyleFields) {
    if (!(field in source)) {
      continue;
    }

    const raw = source[field];
    let value: unknown;

    if ((colorFields as readonly string[]).includes(field)) {
      value = readColor(raw);
    } else if (field in enumFields) {
      value = readEnum(raw, enumFields[field as keyof typeof enumFields]);
    } else if (field === "overlayStrength") {
      value = readOverlay(raw);
    } else if (field === "sectionOrder") {
      value = readSectionOrder(raw);
    } else {
      value = readSectionSizes(raw);
    }

    if (value === undefined) {
      skipped += 1;
    } else {
      style[field] = value;
    }
  }

  if (Object.keys(style).length === 0) {
    return { ok: false, error: "empty" };
  }

  return { ok: true, style: style as ProfileStylePatch, skipped };
}

/**
 * Put a look from a file on a profile. As with themes, the author's own hero
 * photo or video stays; a file made on a profile with a photo carries no photo,
 * so without one of their own the hero gets the file's gradient colours.
 */
export function applyProfileStyle(
  presentation: ProfilePresentation,
  style: ProfileStylePatch,
): ProfilePresentation {
  const { backgroundMode, sectionOrder, sectionSizes, ...rest } = style;
  const keepsHeroMedia =
    (presentation.backgroundMode === "image" || presentation.backgroundMode === "video") &&
    Boolean(presentation.backgroundUrl);
  const nextBackgroundMode =
    keepsHeroMedia || backgroundMode === undefined
      ? presentation.backgroundMode
      : backgroundMode === "image" || backgroundMode === "video"
        ? "gradient"
        : backgroundMode;

  return {
    ...presentation,
    ...rest,
    backgroundMode: nextBackgroundMode,
    sectionOrder: sectionOrder ? [...sectionOrder] : presentation.sectionOrder,
    sectionSizes: { ...presentation.sectionSizes, ...sectionSizes },
  };
}
