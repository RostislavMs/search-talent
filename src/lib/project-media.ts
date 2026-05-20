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
