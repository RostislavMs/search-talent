export const projectMediaKinds = ["image", "video", "file"] as const;

export type ProjectMediaKind = (typeof projectMediaKinds)[number];

export type ProjectMediaItem = {
  id: string;
  project_id: string;
  owner_id?: string | null;
  url: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  media_kind: ProjectMediaKind | null;
  sort_index?: number | null;
  created_at?: string | null;
};

const imageExtensionPattern = /\.(avif|gif|heic|jpeg|jpg|png|svg|webp)$/i;
const videoExtensionPattern = /\.(m4v|mov|mp4|mpeg|mpg|ogv|webm)$/i;

const youTubeHostPattern = /(?:^|\.)((?:youtube\.com)|(?:youtu\.be))$/i;

export function getYouTubeVideoId(value: string | null | undefined): string | null {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();

  if (!youTubeHostPattern.test(hostname)) {
    return null;
  }

  if (hostname.endsWith("youtu.be")) {
    const id = url.pathname.replace(/^\/+/, "").split("/")[0];
    return /^[\w-]{6,15}$/.test(id) ? id : null;
  }

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return id && /^[\w-]{6,15}$/.test(id) ? id : null;
  }

  const embedMatch = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,15})/);
  if (embedMatch) {
    return embedMatch[1];
  }

  return null;
}

export function isYouTubeMediaUrl(value: string | null | undefined): boolean {
  return getYouTubeVideoId(value) !== null;
}

export function buildYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function buildYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

// ---------------------------------------------------------------------------
// Unified video-link embedding
//
// A single detector recognises the platforms creators actually publish on and
// returns everything the UI needs to embed the clip inline: the iframe `src`,
// a best-effort poster (only the ones we can derive without a network call),
// and the natural orientation so vertical clips (Shorts/Reels/TikTok) are not
// stretched into a 16:9 box. Detection is URL-based, so nothing extra needs to
// be persisted — the same URL that is stored is re-parsed at render time.
//
// Every `embedUrl` host below must also be whitelisted in the CSP `frame-src`
// (see src/lib/security/headers.ts) or the browser will refuse to load it.
// ---------------------------------------------------------------------------

export const videoEmbedProviders = [
  "youtube",
  "vimeo",
  "tiktok",
  "instagram",
] as const;

export type VideoEmbedProvider = (typeof videoEmbedProviders)[number];

export type VideoEmbedOrientation = "landscape" | "portrait";

export type VideoEmbed = {
  provider: VideoEmbedProvider;
  embedUrl: string;
  // Only set when we can build a poster without a network round-trip
  // (YouTube). Others resolve their poster lazily via oEmbed elsewhere.
  thumbnailUrl: string | null;
  aspectRatio: number;
  orientation: VideoEmbedOrientation;
};

const LANDSCAPE_ASPECT = 16 / 9;
const PORTRAIT_ASPECT = 9 / 16;
// Instagram feed posts render in a squarish card (image + caption chrome).
const INSTAGRAM_POST_ASPECT = 4 / 5;

function orientationFor(aspectRatio: number): VideoEmbedOrientation {
  return aspectRatio < 0.95 ? "portrait" : "landscape";
}

/**
 * Recognises a pasted link as an embeddable video and returns its embed
 * descriptor, or `null` if the URL is not a supported video link. Callers use
 * the `null` result to both reject invalid input and to fall back to a plain
 * anchor. Short share links that hide the id (e.g. `vm.tiktok.com/…`) return
 * `null` because the canonical id cannot be resolved client-side.
 */
export function detectVideoEmbed(
  value: string | null | undefined,
): VideoEmbed | null {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  // YouTube (incl. Shorts, which are vertical).
  const youTubeId = getYouTubeVideoId(value);
  if (youTubeId) {
    const isShorts = /\/shorts\//.test(url.pathname);
    const aspectRatio = isShorts ? PORTRAIT_ASPECT : LANDSCAPE_ASPECT;
    return {
      provider: "youtube",
      embedUrl: buildYouTubeEmbedUrl(youTubeId),
      thumbnailUrl: buildYouTubeThumbnailUrl(youTubeId),
      aspectRatio,
      orientation: orientationFor(aspectRatio),
    };
  }

  // Vimeo: vimeo.com/{id}, vimeo.com/channels/x/{id}, player.vimeo.com/video/{id}
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const numericId = url.pathname
      .split("/")
      .filter(Boolean)
      .reverse()
      .find((segment) => /^\d+$/.test(segment));
    if (numericId) {
      return {
        provider: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${numericId}`,
        thumbnailUrl: null,
        aspectRatio: LANDSCAPE_ASPECT,
        orientation: "landscape",
      };
    }
    return null;
  }

  // TikTok: tiktok.com/@user/video/{id}
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (match) {
      return {
        provider: "tiktok",
        embedUrl: `https://www.tiktok.com/player/v1/${match[1]}`,
        thumbnailUrl: null,
        aspectRatio: PORTRAIT_ASPECT,
        orientation: "portrait",
      };
    }
    return null;
  }

  // Instagram: /p/{code}, /reel/{code}, /reels/{code}, /tv/{code}
  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    const match = url.pathname.match(
      /\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/,
    );
    if (match) {
      const type = match[1] === "reels" ? "reel" : match[1];
      const isReel = type === "reel";
      const aspectRatio = isReel ? PORTRAIT_ASPECT : INSTAGRAM_POST_ASPECT;
      return {
        provider: "instagram",
        embedUrl: `https://www.instagram.com/${type}/${match[2]}/embed`,
        thumbnailUrl: null,
        aspectRatio,
        orientation: orientationFor(aspectRatio),
      };
    }
    return null;
  }

  return null;
}

/**
 * A poster URL for a link that can be derived synchronously (YouTube only for
 * now). Used as a cover-image fallback for video-only projects.
 */
export function getVideoEmbedThumbnail(
  value: string | null | undefined,
): string | null {
  return detectVideoEmbed(value)?.thumbnailUrl ?? null;
}

export function inferProjectMediaKind(
  mimeType?: string | null,
  fileNameOrUrl?: string | null,
): ProjectMediaKind {
  if (mimeType?.startsWith("image/")) {
    return "image";
  }

  if (mimeType?.startsWith("video/")) {
    return "video";
  }

  if (fileNameOrUrl && imageExtensionPattern.test(fileNameOrUrl)) {
    return "image";
  }

  if (fileNameOrUrl && videoExtensionPattern.test(fileNameOrUrl)) {
    return "video";
  }

  return "file";
}

export function normalizeProjectMediaItem<T extends Partial<ProjectMediaItem>>(
  media: T,
): T & { media_kind: ProjectMediaKind } {
  return {
    ...media,
    media_kind: inferProjectMediaKind(media.mime_type, media.file_name || media.url),
  };
}

export function formatFileSize(size: number | null | undefined) {
  if (!size || size < 1) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

export function sanitizeStorageFileName(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  const name = lastDotIndex > -1 ? fileName.slice(0, lastDotIndex) : fileName;
  const extension = lastDotIndex > -1 ? fileName.slice(lastDotIndex).toLowerCase() : "";

  const sanitizedBase = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

  return `${sanitizedBase || "file"}${extension}`;
}
