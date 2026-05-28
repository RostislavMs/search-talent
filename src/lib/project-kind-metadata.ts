// Per-kind structured details for a project.
//
// Each role packs its specialised fields into `projects.kind_metadata`
// (one jsonb column). This module owns the typed slices, the option
// catalogues, and the normalisers that turn raw DB values into typed
// shapes for the UI/server.

import type { ProjectKind } from "@/lib/projects";

// =====================================================================
// Design
// =====================================================================

export const designRoles = [
  "ui",
  "ux",
  "product",
  "brand",
  "web",
  "mobile",
  "illustration",
  "motion",
  "type",
  "packaging",
  "icon",
] as const;

export type DesignRole = (typeof designRoles)[number];

export const designTools = [
  "figma",
  "sketch",
  "adobe_xd",
  "photoshop",
  "illustrator",
  "indesign",
  "after_effects",
  "framer",
  "webflow",
  "procreate",
  "blender",
  "spline",
] as const;

export type DesignTool = (typeof designTools)[number];

export const designDeliverables = [
  "logo",
  "brand_book",
  "ui_kit",
  "design_system",
  "landing",
  "website",
  "mobile_screens",
  "prototype",
  "icon_set",
  "illustration",
  "packaging",
  "print",
  "animation",
] as const;

export type DesignDeliverable = (typeof designDeliverables)[number];

export type DesignKindMetadata = {
  role: DesignRole | null;
  tools: DesignTool[];
  figmaUrl: string | null;
  behanceUrl: string | null;
  dribbbleUrl: string | null;
  client: string | null;
  deliverables: DesignDeliverable[];
};

export function createEmptyDesignKindMetadata(): DesignKindMetadata {
  return {
    role: null,
    tools: [],
    figmaUrl: null,
    behanceUrl: null,
    dribbbleUrl: null,
    client: null,
    deliverables: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown, max = 500): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, max);
}

function pickEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : null;
}

function pickEnumArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  maxLength = 20,
): T[number][] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowedSet = new Set(allowed as readonly string[]);
  const result: T[number][] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!allowedSet.has(item) || seen.has(item)) continue;
    seen.add(item);
    result.push(item as T[number]);
    if (result.length >= maxLength) break;
  }
  return result;
}

export function normalizeDesignKindMetadata(value: unknown): DesignKindMetadata {
  if (!isRecord(value)) {
    return createEmptyDesignKindMetadata();
  }
  return {
    role: pickEnum(value.role, designRoles),
    tools: pickEnumArray(value.tools, designTools),
    figmaUrl: normalizeOptionalString(value.figmaUrl, 2048),
    behanceUrl: normalizeOptionalString(value.behanceUrl, 2048),
    dribbbleUrl: normalizeOptionalString(value.dribbbleUrl, 2048),
    client: normalizeOptionalString(value.client, 160),
    deliverables: pickEnumArray(value.deliverables, designDeliverables),
  };
}

export function isDesignKindMetadataEmpty(value: DesignKindMetadata): boolean {
  return (
    !value.role &&
    value.tools.length === 0 &&
    !value.figmaUrl &&
    !value.behanceUrl &&
    !value.dribbbleUrl &&
    !value.client &&
    value.deliverables.length === 0
  );
}

// =====================================================================
// Code
// =====================================================================

export const codeArchitectures = [
  "web_app",
  "mobile_app",
  "desktop_app",
  "browser_extension",
  "cli_tool",
  "library",
  "sdk",
  "api",
  "microservices",
  "monolith",
  "monorepo",
  "bot",
  "game",
  "plugin",
  "framework",
  "data_pipeline",
  "ml_model",
  "other",
] as const;

export type CodeArchitecture = (typeof codeArchitectures)[number];

// Plain string labels (vendor names) — kept here as a closed list so
// the UI can offer chips, but the labels themselves are not localised.
export const codeLanguages = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "Kotlin",
  "Swift",
  "C#",
  "C++",
  "C",
  "Ruby",
  "PHP",
  "Elixir",
  "Scala",
  "Dart",
  "Lua",
  "Haskell",
  "Other",
] as const;

export type CodeLanguage = (typeof codeLanguages)[number];

export const codeHostings = [
  "Vercel",
  "AWS",
  "GCP",
  "Azure",
  "Cloudflare",
  "Netlify",
  "Railway",
  "Fly.io",
  "DigitalOcean",
  "Heroku",
  "Render",
  "Supabase",
  "Firebase",
  "Self-hosted",
  "On-premise",
  "Other",
] as const;

export type CodeHosting = (typeof codeHostings)[number];

export const codeDatabases = [
  "PostgreSQL",
  "MySQL",
  "SQLite",
  "MongoDB",
  "Redis",
  "Firebase",
  "Supabase",
  "DynamoDB",
  "ClickHouse",
  "Elasticsearch",
  "Neo4j",
  "Prisma",
  "Other",
] as const;

export type CodeDatabase = (typeof codeDatabases)[number];

export const codeLicenses = [
  "MIT",
  "Apache-2.0",
  "GPL-3.0",
  "AGPL-3.0",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "LGPL-3.0",
  "Unlicense",
  "Proprietary",
  "Commercial",
] as const;

export type CodeLicense = (typeof codeLicenses)[number];

export type CodeKindMetadata = {
  architecture: CodeArchitecture | null;
  primaryLanguage: CodeLanguage | null;
  hosting: CodeHosting[];
  databases: CodeDatabase[];
  license: CodeLicense | null;
  docsUrl: string | null;
  storybookUrl: string | null;
  apiPlaygroundUrl: string | null;
};

export function createEmptyCodeKindMetadata(): CodeKindMetadata {
  return {
    architecture: null,
    primaryLanguage: null,
    hosting: [],
    databases: [],
    license: null,
    docsUrl: null,
    storybookUrl: null,
    apiPlaygroundUrl: null,
  };
}

export function normalizeCodeKindMetadata(value: unknown): CodeKindMetadata {
  if (!isRecord(value)) {
    return createEmptyCodeKindMetadata();
  }
  return {
    architecture: pickEnum(value.architecture, codeArchitectures),
    primaryLanguage: pickEnum(value.primaryLanguage, codeLanguages),
    hosting: pickEnumArray(value.hosting, codeHostings),
    databases: pickEnumArray(value.databases, codeDatabases),
    license: pickEnum(value.license, codeLicenses),
    docsUrl: normalizeOptionalString(value.docsUrl, 2048),
    storybookUrl: normalizeOptionalString(value.storybookUrl, 2048),
    apiPlaygroundUrl: normalizeOptionalString(value.apiPlaygroundUrl, 2048),
  };
}

export function isCodeKindMetadataEmpty(value: CodeKindMetadata): boolean {
  return (
    !value.architecture &&
    !value.primaryLanguage &&
    value.hosting.length === 0 &&
    value.databases.length === 0 &&
    !value.license &&
    !value.docsUrl &&
    !value.storybookUrl &&
    !value.apiPlaygroundUrl
  );
}

// =====================================================================
// Video
// =====================================================================

export const videoRoles = [
  "editor",
  "colorist",
  "motion",
  "vfx",
  "sound",
  "director",
  "dop",
  "animator",
  "producer",
] as const;

export type VideoRole = (typeof videoRoles)[number];

export const videoTools = [
  "Premiere Pro",
  "DaVinci Resolve",
  "After Effects",
  "Final Cut Pro",
  "Avid Media Composer",
  "Fusion",
  "Nuke",
  "Cinema 4D",
  "Blender",
  "Houdini",
  "Audition",
  "Pro Tools",
  "Logic Pro",
  "Ableton Live",
  "Other",
] as const;

export type VideoTool = (typeof videoTools)[number];

export const videoGenres = [
  "commercial",
  "music_video",
  "documentary",
  "short_film",
  "feature_film",
  "vlog",
  "gameplay",
  "tutorial",
  "corporate",
  "event",
  "social_media",
  "advertising",
  "trailer",
  "animation",
] as const;

export type VideoGenre = (typeof videoGenres)[number];

export const videoResolutions = [
  "720p",
  "1080p",
  "2K",
  "4K",
  "6K",
  "8K",
] as const;

export type VideoResolution = (typeof videoResolutions)[number];

export const videoFrameRates = [
  "24",
  "25",
  "30",
  "50",
  "60",
  "120",
] as const;

export type VideoFrameRate = (typeof videoFrameRates)[number];

export type VideoKindMetadata = {
  role: VideoRole | null;
  tools: VideoTool[];
  genres: VideoGenre[];
  resolution: VideoResolution | null;
  frameRate: VideoFrameRate | null;
  durationSeconds: number | null;
  showreelUrl: string | null;
  client: string | null;
};

export function createEmptyVideoKindMetadata(): VideoKindMetadata {
  return {
    role: null,
    tools: [],
    genres: [],
    resolution: null,
    frameRate: null,
    durationSeconds: null,
    showreelUrl: null,
    client: null,
  };
}

function pickPositiveInt(value: unknown, max = 24 * 60 * 60): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.min(Math.floor(value), max);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(Math.floor(parsed), max);
    }
  }
  return null;
}

export function normalizeVideoKindMetadata(value: unknown): VideoKindMetadata {
  if (!isRecord(value)) {
    return createEmptyVideoKindMetadata();
  }
  return {
    role: pickEnum(value.role, videoRoles),
    tools: pickEnumArray(value.tools, videoTools),
    genres: pickEnumArray(value.genres, videoGenres),
    resolution: pickEnum(value.resolution, videoResolutions),
    frameRate: pickEnum(value.frameRate, videoFrameRates),
    durationSeconds: pickPositiveInt(value.durationSeconds),
    showreelUrl: normalizeOptionalString(value.showreelUrl, 2048),
    client: normalizeOptionalString(value.client, 160),
  };
}

export function isVideoKindMetadataEmpty(value: VideoKindMetadata): boolean {
  return (
    !value.role &&
    value.tools.length === 0 &&
    value.genres.length === 0 &&
    !value.resolution &&
    !value.frameRate &&
    value.durationSeconds === null &&
    !value.showreelUrl &&
    !value.client
  );
}

// Helper used by the public page: turn a Vimeo or YouTube URL into an
// iframe src. Returns null if the URL is not recognised — the caller
// then falls back to a plain link.
export function getVideoEmbedUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([\w-]+)/);
      if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      const embedMatch = parsed.pathname.match(/^\/embed\/([\w-]+)/);
      if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) {
        return `https://player.vimeo.com/video/${id}`;
      }
    }
    if (host === "player.vimeo.com") {
      return url;
    }
  } catch {
    return null;
  }
  return null;
}

// =====================================================================
// Photo
// =====================================================================

export const photoRoles = [
  "photographer",
  "retoucher",
  "art_director",
  "stylist",
  "assistant",
] as const;

export type PhotoRole = (typeof photoRoles)[number];

export const photoGenres = [
  "portrait",
  "product",
  "fashion",
  "wedding",
  "event",
  "landscape",
  "architecture",
  "street",
  "documentary",
  "sport",
  "food",
  "automotive",
  "wildlife",
  "fine_art",
  "stock",
] as const;

export type PhotoGenre = (typeof photoGenres)[number];

export const photoCameraBrands = [
  "Canon",
  "Sony",
  "Nikon",
  "Fujifilm",
  "Leica",
  "Hasselblad",
  "Phase One",
  "Pentax",
  "Olympus",
  "Panasonic",
  "Sigma",
  "Ricoh",
  "Mobile",
  "Other",
] as const;

export type PhotoCameraBrand = (typeof photoCameraBrands)[number];

export const photoEditingTools = [
  "Lightroom",
  "Photoshop",
  "Capture One",
  "DxO PhotoLab",
  "Affinity Photo",
  "Luminar",
  "RawTherapee",
  "Darktable",
  "Snapseed",
  "VSCO",
] as const;

export type PhotoEditingTool = (typeof photoEditingTools)[number];

export const photoMediums = [
  "digital",
  "film_35mm",
  "film_medium_format",
  "film_large_format",
  "instant",
  "mobile",
] as const;

export type PhotoMedium = (typeof photoMediums)[number];

export type PhotoKindMetadata = {
  role: PhotoRole | null;
  genres: PhotoGenre[];
  cameras: PhotoCameraBrand[];
  editingTools: PhotoEditingTool[];
  medium: PhotoMedium | null;
  shotCount: number | null;
  location: string | null;
  client: string | null;
};

export function createEmptyPhotoKindMetadata(): PhotoKindMetadata {
  return {
    role: null,
    genres: [],
    cameras: [],
    editingTools: [],
    medium: null,
    shotCount: null,
    location: null,
    client: null,
  };
}

export function normalizePhotoKindMetadata(value: unknown): PhotoKindMetadata {
  if (!isRecord(value)) {
    return createEmptyPhotoKindMetadata();
  }
  return {
    role: pickEnum(value.role, photoRoles),
    genres: pickEnumArray(value.genres, photoGenres),
    cameras: pickEnumArray(value.cameras, photoCameraBrands),
    editingTools: pickEnumArray(value.editingTools, photoEditingTools),
    medium: pickEnum(value.medium, photoMediums),
    shotCount: pickPositiveInt(value.shotCount, 1_000_000),
    location: normalizeOptionalString(value.location, 160),
    client: normalizeOptionalString(value.client, 160),
  };
}

export function isPhotoKindMetadataEmpty(value: PhotoKindMetadata): boolean {
  return (
    !value.role &&
    value.genres.length === 0 &&
    value.cameras.length === 0 &&
    value.editingTools.length === 0 &&
    !value.medium &&
    value.shotCount === null &&
    !value.location &&
    !value.client
  );
}

// =====================================================================
// 3D
// =====================================================================

export const threeDRoles = [
  "modeling",
  "sculpting",
  "rigging",
  "animation",
  "texturing",
  "lighting",
  "fx",
  "look_dev",
  "generalist",
  "concept",
] as const;

export type ThreeDRole = (typeof threeDRoles)[number];

export const threeDSoftware = [
  "Blender",
  "Cinema 4D",
  "Maya",
  "3ds Max",
  "Houdini",
  "ZBrush",
  "Substance Painter",
  "Substance Designer",
  "Marmoset",
  "Unreal Engine",
  "Unity",
  "Spline",
  "Marvelous Designer",
  "Mari",
  "Modo",
] as const;

export type ThreeDSoftware = (typeof threeDSoftware)[number];

export const threeDRenderEngines = [
  "Cycles",
  "Eevee",
  "Redshift",
  "Octane",
  "Arnold",
  "V-Ray",
  "RenderMan",
  "Unreal",
  "Unity HDRP",
  "Marmoset",
  "KeyShot",
  "Lumion",
  "Other",
] as const;

export type ThreeDRenderEngine = (typeof threeDRenderEngines)[number];

export const threeDStyles = [
  "realistic",
  "stylized",
  "lowpoly",
  "voxel",
  "anime",
  "hard_surface",
  "organic",
  "sculpt",
  "abstract",
] as const;

export type ThreeDStyle = (typeof threeDStyles)[number];

export type ThreeDKindMetadata = {
  role: ThreeDRole | null;
  software: ThreeDSoftware[];
  renderEngine: ThreeDRenderEngine | null;
  styles: ThreeDStyle[];
  polygonCount: number | null;
  modelUrl: string | null;
  client: string | null;
};

export function createEmptyThreeDKindMetadata(): ThreeDKindMetadata {
  return {
    role: null,
    software: [],
    renderEngine: null,
    styles: [],
    polygonCount: null,
    modelUrl: null,
    client: null,
  };
}

export function normalizeThreeDKindMetadata(value: unknown): ThreeDKindMetadata {
  if (!isRecord(value)) {
    return createEmptyThreeDKindMetadata();
  }
  return {
    role: pickEnum(value.role, threeDRoles),
    software: pickEnumArray(value.software, threeDSoftware),
    renderEngine: pickEnum(value.renderEngine, threeDRenderEngines),
    styles: pickEnumArray(value.styles, threeDStyles),
    polygonCount: pickPositiveInt(value.polygonCount, 1_000_000_000),
    modelUrl: normalizeOptionalString(value.modelUrl, 2048),
    client: normalizeOptionalString(value.client, 160),
  };
}

export function isThreeDKindMetadataEmpty(value: ThreeDKindMetadata): boolean {
  return (
    !value.role &&
    value.software.length === 0 &&
    !value.renderEngine &&
    value.styles.length === 0 &&
    value.polygonCount === null &&
    !value.modelUrl &&
    !value.client
  );
}

// Helper used by the public page: turn a Sketchfab or Spline URL into
// an embeddable iframe src. Returns null if the URL is not recognised
// — the caller falls back to a plain link.
export function getThreeDEmbedUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "sketchfab.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (
        parts[0] === "models" &&
        parts[1] &&
        /^[a-f0-9]{32}$/i.test(parts[1])
      ) {
        return `https://sketchfab.com/models/${parts[1]}/embed`;
      }
      if (parts[0] === "3d-models" && parts[1]) {
        const tail = parts[1].split("-").pop();
        if (tail && /^[a-f0-9]{32}$/i.test(tail)) {
          return `https://sketchfab.com/models/${tail}/embed`;
        }
      }
    }
    if (host === "my.spline.design" || host === "app.spline.design") {
      // Spline scenes embed by URL as-is. Reject if the path is empty.
      if (parsed.pathname.replace(/\//g, "").length > 0) {
        return url;
      }
    }
  } catch {
    return null;
  }
  return null;
}

// =====================================================================
// Audio / music
// =====================================================================

export const audioRoles = [
  "composer",
  "producer",
  "sound_designer",
  "mixing",
  "mastering",
  "songwriter",
  "vocalist",
  "instrumentalist",
  "dj",
  "foley",
  "arranger",
] as const;

export type AudioRole = (typeof audioRoles)[number];

export const audioGenres = [
  "electronic",
  "hip_hop",
  "pop",
  "rock",
  "jazz",
  "classical",
  "ambient",
  "techno",
  "house",
  "drum_and_bass",
  "lofi",
  "folk",
  "metal",
  "rnb",
  "soundtrack",
  "game_audio",
  "experimental",
] as const;

export type AudioGenre = (typeof audioGenres)[number];

export const audioDaws = [
  "Ableton Live",
  "FL Studio",
  "Logic Pro",
  "Pro Tools",
  "Cubase",
  "Studio One",
  "Reason",
  "Bitwig",
  "GarageBand",
  "Reaper",
  "Renoise",
  "Other",
] as const;

export type AudioDaw = (typeof audioDaws)[number];

// Musical key — both major and minor in flat-friendly notation.
// Stored as a single string enum to keep filtering trivial.
export const audioKeys = [
  "C major",
  "C minor",
  "C# major",
  "C# minor",
  "D major",
  "D minor",
  "Eb major",
  "Eb minor",
  "E major",
  "E minor",
  "F major",
  "F minor",
  "F# major",
  "F# minor",
  "G major",
  "G minor",
  "Ab major",
  "Ab minor",
  "A major",
  "A minor",
  "Bb major",
  "Bb minor",
  "B major",
  "B minor",
] as const;

export type AudioKey = (typeof audioKeys)[number];

export type AudioKindMetadata = {
  role: AudioRole | null;
  genres: AudioGenre[];
  daws: AudioDaw[];
  trackUrl: string | null;
  durationSeconds: number | null;
  bpm: number | null;
  musicalKey: AudioKey | null;
  client: string | null;
};

export function createEmptyAudioKindMetadata(): AudioKindMetadata {
  return {
    role: null,
    genres: [],
    daws: [],
    trackUrl: null,
    durationSeconds: null,
    bpm: null,
    musicalKey: null,
    client: null,
  };
}

export function normalizeAudioKindMetadata(value: unknown): AudioKindMetadata {
  if (!isRecord(value)) {
    return createEmptyAudioKindMetadata();
  }
  return {
    role: pickEnum(value.role, audioRoles),
    genres: pickEnumArray(value.genres, audioGenres),
    daws: pickEnumArray(value.daws, audioDaws),
    trackUrl: normalizeOptionalString(value.trackUrl, 2048),
    durationSeconds: pickPositiveInt(value.durationSeconds, 12 * 60 * 60),
    bpm: pickPositiveInt(value.bpm, 400),
    musicalKey: pickEnum(value.musicalKey, audioKeys),
    client: normalizeOptionalString(value.client, 160),
  };
}

export function isAudioKindMetadataEmpty(value: AudioKindMetadata): boolean {
  return (
    !value.role &&
    value.genres.length === 0 &&
    value.daws.length === 0 &&
    !value.trackUrl &&
    value.durationSeconds === null &&
    value.bpm === null &&
    !value.musicalKey &&
    !value.client
  );
}

// Helper used by the public page: turn a Soundcloud or Spotify URL into
// an embeddable iframe src. Returns null if the URL is not recognised
// — the caller falls back to a plain link.
export function getAudioEmbedUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "soundcloud.com" || host === "on.soundcloud.com") {
      // SoundCloud player wraps the canonical track URL.
      const encoded = encodeURIComponent(url);
      return `https://w.soundcloud.com/player/?url=${encoded}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`;
    }
    if (host === "open.spotify.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      // Supported: /track/<id>, /album/<id>, /playlist/<id>, /episode/<id>
      if (
        parts.length === 2 &&
        ["track", "album", "playlist", "episode"].includes(parts[0]) &&
        /^[A-Za-z0-9]+$/.test(parts[1])
      ) {
        return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

// =====================================================================
// QA / testing
// =====================================================================

export const qaRoles = [
  "manual_qa",
  "automation_qa",
  "qa_lead",
  "test_architect",
  "performance",
  "security",
  "mobile",
  "accessibility",
  "usability",
  "exploratory",
] as const;

export type QaRole = (typeof qaRoles)[number];

export const qaTestTypes = [
  "manual",
  "automation",
  "performance",
  "load",
  "security",
  "api",
  "ui",
  "mobile",
  "accessibility",
  "usability",
  "regression",
  "smoke",
  "exploratory",
  "integration",
  "unit",
  "e2e",
] as const;

export type QaTestType = (typeof qaTestTypes)[number];

export const qaTools = [
  "Selenium",
  "Cypress",
  "Playwright",
  "Puppeteer",
  "WebdriverIO",
  "TestCafe",
  "Appium",
  "Detox",
  "Postman",
  "Insomnia",
  "JMeter",
  "K6",
  "Gatling",
  "Burp Suite",
  "OWASP ZAP",
  "Jira",
  "TestRail",
  "Zephyr",
  "Xray",
  "Allure",
  "Jest",
  "Mocha",
  "Pytest",
  "JUnit",
  "Other",
] as const;

export type QaTool = (typeof qaTools)[number];

export const qaMethodologies = [
  "agile",
  "scrum",
  "kanban",
  "waterfall",
  "bdd",
  "tdd",
  "shift_left",
  "risk_based",
] as const;

export type QaMethodology = (typeof qaMethodologies)[number];

export const qaCertifications = [
  "ISTQB Foundation",
  "ISTQB Advanced",
  "ISTQB Expert",
  "Certified Agile Tester",
  "CSTE",
  "CSQA",
  "CMSQ",
  "Selenium Certified",
  "AWS Certified",
] as const;

export type QaCertification = (typeof qaCertifications)[number];

export type QaKindMetadata = {
  role: QaRole | null;
  testTypes: QaTestType[];
  tools: QaTool[];
  methodologies: QaMethodology[];
  certifications: QaCertification[];
  testCasesCount: number | null;
  bugsFoundCount: number | null;
  automationCoveragePercent: number | null;
  reportUrl: string | null;
  client: string | null;
};

export function createEmptyQaKindMetadata(): QaKindMetadata {
  return {
    role: null,
    testTypes: [],
    tools: [],
    methodologies: [],
    certifications: [],
    testCasesCount: null,
    bugsFoundCount: null,
    automationCoveragePercent: null,
    reportUrl: null,
    client: null,
  };
}

function pickPercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return Math.round(parsed);
}

export function normalizeQaKindMetadata(value: unknown): QaKindMetadata {
  if (!isRecord(value)) {
    return createEmptyQaKindMetadata();
  }
  return {
    role: pickEnum(value.role, qaRoles),
    testTypes: pickEnumArray(value.testTypes, qaTestTypes),
    tools: pickEnumArray(value.tools, qaTools),
    methodologies: pickEnumArray(value.methodologies, qaMethodologies),
    certifications: pickEnumArray(value.certifications, qaCertifications),
    testCasesCount: pickPositiveInt(value.testCasesCount, 1_000_000),
    bugsFoundCount: pickPositiveInt(value.bugsFoundCount, 1_000_000),
    automationCoveragePercent: pickPercent(value.automationCoveragePercent),
    reportUrl: normalizeOptionalString(value.reportUrl, 2048),
    client: normalizeOptionalString(value.client, 160),
  };
}

export function isQaKindMetadataEmpty(value: QaKindMetadata): boolean {
  return (
    !value.role &&
    value.testTypes.length === 0 &&
    value.tools.length === 0 &&
    value.methodologies.length === 0 &&
    value.certifications.length === 0 &&
    value.testCasesCount === null &&
    value.bugsFoundCount === null &&
    value.automationCoveragePercent === null &&
    !value.reportUrl &&
    !value.client
  );
}

// =====================================================================
// Motion graphics
// =====================================================================

export const motionRoles = [
  "motion_designer",
  "animator",
  "character_animator",
  "art_director",
  "illustrator",
  "compositor",
  "fx_artist",
  "lead",
] as const;

export type MotionRole = (typeof motionRoles)[number];

export const motionTechniques = [
  "2d",
  "3d",
  "mixed",
  "frame_by_frame",
  "character",
  "kinetic_typography",
  "infographic",
  "particle_fx",
  "rotoscope",
  "motion_capture",
  "cell_animation",
  "stop_motion",
  "isometric",
] as const;

export type MotionTechnique = (typeof motionTechniques)[number];

export const motionTools = [
  "After Effects",
  "Cinema 4D",
  "Blender",
  "Houdini",
  "Cavalry",
  "Lottie",
  "Spine",
  "Rive",
  "Toon Boom Harmony",
  "Adobe Animate",
  "TVPaint",
  "Moho",
  "Procreate Dreams",
  "Nuke",
  "Fusion",
  "Other",
] as const;

export type MotionTool = (typeof motionTools)[number];

export const motionPurposes = [
  "logo_reveal",
  "explainer",
  "intro_outro",
  "commercial",
  "social_media",
  "app_animation",
  "lottie_animation",
  "ui_animation",
  "opener",
  "music_video",
  "title_sequence",
  "game_animation",
  "education",
  "broadcast",
] as const;

export type MotionPurpose = (typeof motionPurposes)[number];

export type MotionKindMetadata = {
  role: MotionRole | null;
  techniques: MotionTechnique[];
  tools: MotionTool[];
  purposes: MotionPurpose[];
  durationSeconds: number | null;
  previewUrl: string | null;
  client: string | null;
};

export function createEmptyMotionKindMetadata(): MotionKindMetadata {
  return {
    role: null,
    techniques: [],
    tools: [],
    purposes: [],
    durationSeconds: null,
    previewUrl: null,
    client: null,
  };
}

export function normalizeMotionKindMetadata(value: unknown): MotionKindMetadata {
  if (!isRecord(value)) {
    return createEmptyMotionKindMetadata();
  }
  return {
    role: pickEnum(value.role, motionRoles),
    techniques: pickEnumArray(value.techniques, motionTechniques),
    tools: pickEnumArray(value.tools, motionTools),
    purposes: pickEnumArray(value.purposes, motionPurposes),
    durationSeconds: pickPositiveInt(value.durationSeconds, 24 * 60 * 60),
    previewUrl: normalizeOptionalString(value.previewUrl, 2048),
    client: normalizeOptionalString(value.client, 160),
  };
}

export function isMotionKindMetadataEmpty(value: MotionKindMetadata): boolean {
  return (
    !value.role &&
    value.techniques.length === 0 &&
    value.tools.length === 0 &&
    value.purposes.length === 0 &&
    value.durationSeconds === null &&
    !value.previewUrl &&
    !value.client
  );
}

// =====================================================================
// Writing / docs
// =====================================================================

export const writingRoles = [
  "author",
  "copywriter",
  "technical_writer",
  "editor",
  "translator",
  "proofreader",
  "ghostwriter",
  "journalist",
  "content_strategist",
  "ux_writer",
] as const;

export type WritingRole = (typeof writingRoles)[number];

export const writingFormats = [
  "article",
  "blog_post",
  "whitepaper",
  "ebook",
  "documentation",
  "tutorial",
  "case_study",
  "press_release",
  "newsletter",
  "script",
  "copywriting",
  "ux_writing",
  "technical_spec",
  "research_paper",
  "translation",
  "social_media",
] as const;

export type WritingFormat = (typeof writingFormats)[number];

export const writingTopics = [
  "technology",
  "design",
  "marketing",
  "business",
  "science",
  "education",
  "finance",
  "health",
  "lifestyle",
  "gaming",
  "travel",
  "culture",
  "politics",
  "sports",
] as const;

export type WritingTopic = (typeof writingTopics)[number];

export const writingTools = [
  "Notion",
  "Google Docs",
  "Microsoft Word",
  "Scrivener",
  "Markdown",
  "LaTeX",
  "Confluence",
  "Read the Docs",
  "GitBook",
  "Mintlify",
  "Obsidian",
  "Other",
] as const;

export type WritingTool = (typeof writingTools)[number];

// Top languages for IT publishing. `multi` covers bilingual articles
// like uk+en or es+pt where the author maintains parallel versions.
export const writingLanguages = [
  "uk",
  "en",
  "pl",
  "de",
  "es",
  "fr",
  "it",
  "pt",
  "cs",
  "multi",
] as const;

export type WritingLanguage = (typeof writingLanguages)[number];

export type WritingKindMetadata = {
  role: WritingRole | null;
  formats: WritingFormat[];
  topics: WritingTopic[];
  tools: WritingTool[];
  language: WritingLanguage | null;
  wordCount: number | null;
  readingTimeMinutes: number | null;
  articleUrl: string | null;
  client: string | null;
};

export function createEmptyWritingKindMetadata(): WritingKindMetadata {
  return {
    role: null,
    formats: [],
    topics: [],
    tools: [],
    language: null,
    wordCount: null,
    readingTimeMinutes: null,
    articleUrl: null,
    client: null,
  };
}

export function normalizeWritingKindMetadata(
  value: unknown,
): WritingKindMetadata {
  if (!isRecord(value)) {
    return createEmptyWritingKindMetadata();
  }
  return {
    role: pickEnum(value.role, writingRoles),
    formats: pickEnumArray(value.formats, writingFormats),
    topics: pickEnumArray(value.topics, writingTopics),
    tools: pickEnumArray(value.tools, writingTools),
    language: pickEnum(value.language, writingLanguages),
    wordCount: pickPositiveInt(value.wordCount, 10_000_000),
    readingTimeMinutes: pickPositiveInt(value.readingTimeMinutes, 10_000),
    articleUrl: normalizeOptionalString(value.articleUrl, 2048),
    client: normalizeOptionalString(value.client, 160),
  };
}

export function isWritingKindMetadataEmpty(
  value: WritingKindMetadata,
): boolean {
  return (
    !value.role &&
    value.formats.length === 0 &&
    value.topics.length === 0 &&
    value.tools.length === 0 &&
    !value.language &&
    value.wordCount === null &&
    value.readingTimeMinutes === null &&
    !value.articleUrl &&
    !value.client
  );
}

// =====================================================================
// Generic shape for the whole `kind_metadata` column.
// Adds room for future roles (video, photo, 3d, …) without breaking
// existing call sites.
// =====================================================================

export type ProjectKindMetadata = {
  design?: DesignKindMetadata;
  code?: CodeKindMetadata;
  video?: VideoKindMetadata;
  photo?: PhotoKindMetadata;
  threeD?: ThreeDKindMetadata;
  audio?: AudioKindMetadata;
  qa?: QaKindMetadata;
  motion?: MotionKindMetadata;
  writing?: WritingKindMetadata;
};

export function normalizeProjectKindMetadata(
  kind: ProjectKind | null,
  value: unknown,
): ProjectKindMetadata {
  if (!isRecord(value)) {
    return {};
  }
  const result: ProjectKindMetadata = {};
  if (kind === "design" || isRecord(value.design)) {
    const design = normalizeDesignKindMetadata(value.design);
    if (!isDesignKindMetadataEmpty(design)) {
      result.design = design;
    }
  }
  if (kind === "code" || isRecord(value.code)) {
    const code = normalizeCodeKindMetadata(value.code);
    if (!isCodeKindMetadataEmpty(code)) {
      result.code = code;
    }
  }
  if (kind === "video" || isRecord(value.video)) {
    const video = normalizeVideoKindMetadata(value.video);
    if (!isVideoKindMetadataEmpty(video)) {
      result.video = video;
    }
  }
  if (kind === "photo" || isRecord(value.photo)) {
    const photo = normalizePhotoKindMetadata(value.photo);
    if (!isPhotoKindMetadataEmpty(photo)) {
      result.photo = photo;
    }
  }
  if (kind === "3d" || isRecord(value.threeD)) {
    const threeD = normalizeThreeDKindMetadata(value.threeD);
    if (!isThreeDKindMetadataEmpty(threeD)) {
      result.threeD = threeD;
    }
  }
  if (kind === "audio" || isRecord(value.audio)) {
    const audio = normalizeAudioKindMetadata(value.audio);
    if (!isAudioKindMetadataEmpty(audio)) {
      result.audio = audio;
    }
  }
  if (kind === "qa" || isRecord(value.qa)) {
    const qa = normalizeQaKindMetadata(value.qa);
    if (!isQaKindMetadataEmpty(qa)) {
      result.qa = qa;
    }
  }
  if (kind === "motion" || isRecord(value.motion)) {
    const motion = normalizeMotionKindMetadata(value.motion);
    if (!isMotionKindMetadataEmpty(motion)) {
      result.motion = motion;
    }
  }
  if (kind === "writing" || isRecord(value.writing)) {
    const writing = normalizeWritingKindMetadata(value.writing);
    if (!isWritingKindMetadataEmpty(writing)) {
      result.writing = writing;
    }
  }
  return result;
}
