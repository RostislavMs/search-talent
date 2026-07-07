// Poster extraction from an uploaded video File.
//
// Capturing from the *visible* <video> in the picker was unreliable — after a
// programmatic seek the browser often has not decoded/presented a frame yet,
// so drawImage returned frame 0 or a black canvas. This module owns a single
// hidden <video> that is "kick-started" (played once, then paused) so the
// decoder is warm, then seeks and waits for both `seeked` AND a presented
// frame before drawing. Cross-origin sources would taint the canvas, so this
// only works for local File objects (the create flow), not remote CDN urls.

export type CapturedFrame = {
  blob: Blob;
  /** Mean perceived luminance 0–255; ~0 means an all-black frame. */
  luminance: number;
};

export type PosterExtractor = {
  /** Resolves the clip duration in seconds (0 if unknown). */
  ready: Promise<number>;
  /** Captures a frame at `timeSeconds` (or an early frame when omitted). */
  capture: (timeSeconds?: number) => Promise<CapturedFrame | null>;
  dispose: () => void;
};

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
};

const MAX_WIDTH = 1280;

// Resolves on `event`, or after `timeoutMs` (resolve, not reject — a missing
// `seeked` for a tiny seek should still let us try to draw).
function onceEvent(
  target: HTMLVideoElement,
  event: "loadedmetadata" | "loadeddata" | "seeked",
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      target.removeEventListener(event, finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    target.addEventListener(event, finish, { once: true });
  });
}

// Waits until a decoded frame is presented (one requestVideoFrameCallback tick
// where available, else a short delay) so drawImage has real pixels.
function waitForPresentedFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const withCallback = video as VideoWithFrameCallback;
    if (typeof withCallback.requestVideoFrameCallback === "function") {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      withCallback.requestVideoFrameCallback(done);
      setTimeout(done, 500);
    } else {
      setTimeout(resolve, 120);
    }
  });
}

function estimateLuminance(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): number {
  try {
    const { data } = context.getImageData(0, 0, width, height);
    const step = Math.max(4, Math.floor(data.length / 4 / 2000) * 4);
    let sum = 0;
    let count = 0;
    for (let i = 0; i + 2 < data.length; i += step) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count += 1;
    }
    return count > 0 ? sum / count : 255;
  } catch {
    // Tainted canvas (cross-origin) — cannot read pixels; assume non-black.
    return 255;
  }
}

/**
 * Creates a reusable extractor around one hidden <video>. Callers `await
 * ready` for the duration, then call `capture(time)` as many times as needed
 * (e.g. while scrubbing), and `dispose()` when done.
 */
export function createPosterExtractor(file: File): PosterExtractor {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video") as VideoWithFrameCallback;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  // Rendered (so frames are actually presented for canvas) but invisible and
  // behind everything. A 1px / off-screen element does NOT present frames in
  // some browsers, which is what caused every capture to return frame 0.
  video.style.cssText =
    "position:fixed;left:0;top:0;opacity:0.001;pointer-events:none;z-index:-2147483647;";
  document.body.appendChild(video);
  video.src = url;

  const ready = (async () => {
    await onceEvent(video, "loadedmetadata", 8000);
    if (video.readyState < 2) {
      await onceEvent(video, "loadeddata", 8000);
    }
    // Warm the decoder: some browsers won't present a seeked frame to canvas
    // until the video has actually played at least once.
    await video.play().catch(() => {});
    video.pause();
    return Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : 0;
  })();

  async function capture(
    timeSeconds?: number,
  ): Promise<CapturedFrame | null> {
    let duration = 0;
    try {
      duration = await ready;
    } catch {
      return null;
    }

    const target =
      typeof timeSeconds === "number" && Number.isFinite(timeSeconds)
        ? Math.max(0, duration ? Math.min(timeSeconds, duration - 0.05) : timeSeconds)
        : duration
          ? Math.min(Math.max(duration * 0.1, 0.5), Math.max(duration - 0.1, 0))
          : 1;

    if (Math.abs(video.currentTime - target) > 0.05) {
      const seeked = onceEvent(video, "seeked", 8000);
      try {
        video.currentTime = target;
      } catch {
        // Seek unsupported — draw whatever is decoded.
      }
      await seeked;
    }
    await waitForPresentedFrame(video);

    if (!video.videoWidth || !video.videoHeight) {
      return null;
    }

    const scale = video.videoWidth > MAX_WIDTH ? MAX_WIDTH / video.videoWidth : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const luminance = estimateLuminance(context, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/webp", 0.85);
    });

    return blob ? { blob, luminance } : null;
  }

  function dispose() {
    try {
      video.pause();
    } catch {
      // ignore
    }
    video.removeAttribute("src");
    try {
      video.load();
    } catch {
      // ignore
    }
    video.remove();
    URL.revokeObjectURL(url);
  }

  return { ready, capture, dispose };
}

/** One-shot poster capture (used for the automatic cover). */
export async function captureVideoPoster(
  file: File,
  timeSeconds?: number,
): Promise<CapturedFrame | null> {
  const extractor = createPosterExtractor(file);
  try {
    return await extractor.capture(timeSeconds);
  } finally {
    extractor.dispose();
  }
}

/** Wraps a captured blob into a File so it flows through the upload pipeline. */
export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type || "image/webp" });
}
