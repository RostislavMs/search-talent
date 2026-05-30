import { describe, expect, it } from "vitest";
import {
  buildYouTubeEmbedUrl,
  buildYouTubeThumbnailUrl,
  formatFileSize,
  getYouTubeVideoId,
  inferProjectMediaKind,
  isYouTubeMediaUrl,
  normalizeProjectMediaItem,
  sanitizeStorageFileName,
} from "@/lib/project-media";

describe("getYouTubeVideoId", () => {
  it("returns null for null/undefined/empty", () => {
    expect(getYouTubeVideoId(null)).toBeNull();
    expect(getYouTubeVideoId(undefined)).toBeNull();
    expect(getYouTubeVideoId("")).toBeNull();
  });

  it("returns null for non-URL strings", () => {
    expect(getYouTubeVideoId("not a url")).toBeNull();
  });

  it("returns null for non-YouTube URLs", () => {
    expect(getYouTubeVideoId("https://example.com/watch?v=abc123")).toBeNull();
    expect(getYouTubeVideoId("https://vimeo.com/123456")).toBeNull();
  });

  it("extracts ID from youtu.be short URL", () => {
    expect(getYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from youtube.com/watch URL", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from youtube.com/watch with extra params", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from embed URL", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from shorts URL", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts ID from live URL", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for too short or too long video IDs", () => {
    expect(getYouTubeVideoId("https://youtu.be/abc")).toBeNull();
    expect(getYouTubeVideoId("https://youtu.be/abcdefghijklmnop")).toBeNull();
  });

  it("returns null when youtube.com/watch has no v parameter", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch")).toBeNull();
  });
});

describe("isYouTubeMediaUrl", () => {
  it("returns true for valid YouTube URLs", () => {
    expect(isYouTubeMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeMediaUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("returns false for non-YouTube URLs", () => {
    expect(isYouTubeMediaUrl("https://example.com")).toBe(false);
    expect(isYouTubeMediaUrl(null)).toBe(false);
  });
});

describe("buildYouTubeEmbedUrl", () => {
  it("builds a youtube-nocookie embed URL", () => {
    expect(buildYouTubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
});

describe("buildYouTubeThumbnailUrl", () => {
  it("builds an hqdefault thumbnail URL", () => {
    expect(buildYouTubeThumbnailUrl("dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });
});

describe("inferProjectMediaKind", () => {
  it("returns 'image' for image MIME types", () => {
    expect(inferProjectMediaKind("image/png")).toBe("image");
    expect(inferProjectMediaKind("image/jpeg")).toBe("image");
    expect(inferProjectMediaKind("image/webp")).toBe("image");
  });

  it("returns 'video' for video MIME types", () => {
    expect(inferProjectMediaKind("video/mp4")).toBe("video");
    expect(inferProjectMediaKind("video/webm")).toBe("video");
  });

  it("infers 'image' from file extension when MIME is absent", () => {
    expect(inferProjectMediaKind(null, "photo.jpg")).toBe("image");
    expect(inferProjectMediaKind(null, "photo.PNG")).toBe("image");
    expect(inferProjectMediaKind(null, "photo.webp")).toBe("image");
    expect(inferProjectMediaKind(null, "icon.svg")).toBe("image");
    expect(inferProjectMediaKind(null, "animation.gif")).toBe("image");
  });

  it("infers 'video' from file extension when MIME is absent", () => {
    expect(inferProjectMediaKind(null, "clip.mp4")).toBe("video");
    expect(inferProjectMediaKind(null, "clip.MOV")).toBe("video");
    expect(inferProjectMediaKind(null, "clip.webm")).toBe("video");
  });

  it("returns 'file' when MIME and extension are unrecognised", () => {
    expect(inferProjectMediaKind(null, "document.pdf")).toBe("file");
    expect(inferProjectMediaKind("application/pdf", "doc.pdf")).toBe("file");
    expect(inferProjectMediaKind(null, null)).toBe("file");
    expect(inferProjectMediaKind()).toBe("file");
  });

  it("prefers MIME type over extension", () => {
    expect(inferProjectMediaKind("image/png", "file.mp4")).toBe("image");
    expect(inferProjectMediaKind("video/mp4", "photo.jpg")).toBe("video");
  });
});

describe("normalizeProjectMediaItem", () => {
  it("adds inferred media_kind based on mime_type", () => {
    const result = normalizeProjectMediaItem({
      mime_type: "image/png",
      url: "https://example.com/img.png",
    });

    expect(result.media_kind).toBe("image");
  });

  it("falls back to url for extension inference", () => {
    const result = normalizeProjectMediaItem({
      url: "https://example.com/video.mp4",
    });

    expect(result.media_kind).toBe("video");
  });

  it("uses file_name when available and mime_type is missing", () => {
    const result = normalizeProjectMediaItem({
      file_name: "photo.jpg",
      url: "https://example.com/some-hash",
    });

    expect(result.media_kind).toBe("image");
  });
});

describe("formatFileSize", () => {
  it("returns null for null/undefined/0/negative", () => {
    expect(formatFileSize(null)).toBeNull();
    expect(formatFileSize(undefined)).toBeNull();
    expect(formatFileSize(0)).toBeNull();
    expect(formatFileSize(-5)).toBeNull();
  });

  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(1)).toBe("1 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1048576)).toBe("1.0 MB");
    expect(formatFileSize(5 * 1048576)).toBe("5.0 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(1073741824)).toBe("1.0 GB");
  });

  it("rounds values >= 10 to integers", () => {
    expect(formatFileSize(15 * 1024)).toBe("15 KB");
  });

  it("shows one decimal for values < 10", () => {
    expect(formatFileSize(2.5 * 1024)).toBe("2.5 KB");
  });
});

describe("sanitizeStorageFileName", () => {
  it("lowercases and normalizes the basename", () => {
    expect(sanitizeStorageFileName("MyFile.jpg")).toBe("myfile.jpg");
  });

  it("replaces special characters with dashes", () => {
    expect(sanitizeStorageFileName("hello world (copy).png")).toBe("hello-world-copy.png");
  });

  it("collapses multiple dashes", () => {
    expect(sanitizeStorageFileName("a---b---c.txt")).toBe("a-b-c.txt");
  });

  it("handles files without extension", () => {
    expect(sanitizeStorageFileName("README")).toBe("readme");
  });

  it("falls back to 'file' for empty basename", () => {
    expect(sanitizeStorageFileName(".gitignore")).toBe("file.gitignore");
  });

  it("truncates the basename to 60 characters", () => {
    const longName = "a".repeat(80) + ".pdf";
    const result = sanitizeStorageFileName(longName);
    const basename = result.replace(/\.[^.]+$/, "");

    expect(basename.length).toBeLessThanOrEqual(60);
    expect(result.endsWith(".pdf")).toBe(true);
  });

  it("preserves the extension in lowercase", () => {
    expect(sanitizeStorageFileName("File.JPG")).toBe("file.jpg");
  });
});
