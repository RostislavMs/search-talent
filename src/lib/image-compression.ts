export type CompressionPreset = "avatar" | "cover" | "inline" | "photo" | "message";

type PresetConfig = {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  initialQuality: number;
};

const PRESETS: Record<CompressionPreset, PresetConfig> = {
  avatar: { maxSizeMB: 0.2, maxWidthOrHeight: 512, initialQuality: 0.8 },
  cover: { maxSizeMB: 0.6, maxWidthOrHeight: 2048, initialQuality: 0.8 },
  inline: { maxSizeMB: 0.6, maxWidthOrHeight: 2048, initialQuality: 0.8 },
  // "photo" preserves the original file. Photography projects need the
  // full-resolution, original-format asset — running it through any
  // resize/recompress step would defeat the purpose of uploading a photo.
  photo: { maxSizeMB: Infinity, maxWidthOrHeight: Infinity, initialQuality: 1 },
  // A file sent in a message: sharp enough to read a screenshot.
  message: { maxSizeMB: 2, maxWidthOrHeight: 2560, initialQuality: 0.85 },
};

/**
 * Presets whose result is always the re-encoded image, even when it comes out
 * larger: re-encoding is what drops the camera's metadata (where a photo was
 * taken, the device), and a private message must not carry that.
 */
const ALWAYS_REENCODE = new Set<CompressionPreset>(["message"]);

const SKIP_MIME_TYPES = new Set(["image/gif", "image/svg+xml"]);

export async function compressImageFile(
  file: File,
  preset: CompressionPreset,
): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP_MIME_TYPES.has(file.type)) {
    return file;
  }

  if (preset === "photo") {
    return file;
  }

  const { maxSizeMB, maxWidthOrHeight, initialQuality } = PRESETS[preset];

  try {
    // Loaded on demand so the ~50 KiB library only ships to the client when a
    // user actually compresses an image, instead of bloating every form bundle.
    const { default: imageCompression } = await import(
      "browser-image-compression"
    );
    const compressed = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      // Run on the main thread. With `useWebWorker: true` the library spawns
      // a worker that `importScripts()` itself from cdn.jsdelivr.net, which
      // our CSP `script-src` blocks in production — compression then silently
      // falls back to the uncompressed original. Main-thread compression
      // needs no external script and works under the existing CSP.
      useWebWorker: false,
      fileType: "image/webp",
      initialQuality,
    });

    if (compressed.size >= file.size && !ALWAYS_REENCODE.has(preset)) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([compressed], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
