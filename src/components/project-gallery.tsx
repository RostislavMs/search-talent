"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useDictionary } from "@/lib/i18n/client";
import {
  detectVideoEmbed,
  type ProjectMediaItem,
  type VideoEmbed,
} from "@/lib/project-media";
import OptimizedImage from "@/components/ui/optimized-image";

const DEFAULT_ASPECT_RATIO = 16 / 10;
const PORTRAIT_THRESHOLD = 0.95;

function clampAspect(ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return DEFAULT_ASPECT_RATIO;
  return Math.min(Math.max(ratio, 0.5), 2.4);
}

const PROVIDER_LABEL: Record<VideoEmbed["provider"], string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  tiktok: "TikTok",
  instagram: "Instagram",
};

// Measures the natural aspect of an uploaded image/video. `kind: "none"` is
// used for embeds, whose aspect is already known.
function useMediaAspect(
  url: string,
  kind: "image" | "video" | "none",
): number {
  const [ratio, setRatio] = useState<number>(DEFAULT_ASPECT_RATIO);

  useEffect(() => {
    if (kind === "none" || !url) return;

    let cancelled = false;

    if (kind === "image") {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setRatio(
          clampAspect(
            img.naturalWidth && img.naturalHeight
              ? img.naturalWidth / img.naturalHeight
              : DEFAULT_ASPECT_RATIO,
          ),
        );
      };
      img.src = url;
    } else {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        if (cancelled) return;
        setRatio(
          clampAspect(
            video.videoWidth && video.videoHeight
              ? video.videoWidth / video.videoHeight
              : DEFAULT_ASPECT_RATIO,
          ),
        );
      };
      video.src = url;
    }

    return () => {
      cancelled = true;
    };
  }, [url, kind]);

  return ratio;
}

function PlayGlyph() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/30 backdrop-blur transition group-hover:bg-black/70">
      <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

// A calm, uniform placeholder for embeds we cannot thumbnail without a network
// call (TikTok / Instagram / Vimeo). YouTube uses its real thumbnail instead.
function EmbedPoster({ embed }: { embed: VideoEmbed }) {
  return (
    <>
      {embed.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={embed.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(148,163,184,0.22),_transparent_60%)] bg-[color:var(--surface)]" />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <PlayGlyph />
        <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          {PROVIDER_LABEL[embed.provider]}
        </span>
      </div>
    </>
  );
}

function GalleryItem({
  item,
  layout,
  allowDownloads,
  onOpenImage,
  onOpenEmbed,
}: {
  item: ProjectMediaItem;
  layout: "single" | "duo" | "rows";
  allowDownloads: boolean;
  onOpenImage: (url: string) => void;
  onOpenEmbed: (embed: VideoEmbed) => void;
}) {
  const embed = useMemo(() => detectVideoEmbed(item.url), [item.url]);
  const isImage = !embed && item.media_kind === "image";
  const isVideo = !embed && item.media_kind === "video";

  const measuredKind = isImage ? "image" : isVideo ? "video" : "none";
  const measuredAspect = useMediaAspect(
    isImage || isVideo ? item.url : "",
    measuredKind,
  );
  // Posters read cleaner at a consistent shape than each provider's own tall
  // card, so embeds use a fixed 16:9 (landscape) / 4:5 (portrait) frame.
  const aspectRatio = embed
    ? embed.orientation === "portrait"
      ? 4 / 5
      : 16 / 9
    : measuredAspect;
  const isPortrait = aspectRatio < PORTRAIT_THRESHOLD;

  // The <article> owns the sizing box; tiles fill it (absolute inset-0).
  //  - single: centered hero. Width is capped by BOTH a max width and the
  //    viewport height (via aspect ratio) so a tall/square single item can
  //    never grow past the fold — the old width-only cap let portrait/near-
  //    square images overflow the screen vertically.
  //  - duo: fills its grid cell (portrait capped + centered).
  //  - rows: full width on mobile (stacked), fixed height on sm+ so mixed
  //    portrait/landscape items line up as even, justified rows.
  let sizeClass: string;
  const sizeStyle: CSSProperties = { aspectRatio };
  if (layout === "single") {
    sizeClass = "mx-auto";
    sizeStyle.width = `min(100%, 48rem, calc(72vh * ${aspectRatio.toFixed(4)}))`;
  } else if (layout === "duo") {
    sizeClass = isPortrait ? "mx-auto w-full max-w-88" : "w-full";
  } else {
    sizeClass =
      "w-full sm:h-72 sm:w-auto sm:max-w-full sm:flex-none lg:h-80";
  }

  const surface = embed ? "bg-black" : "bg-[color:var(--surface-muted)]";

  return (
    <article
      className={`relative overflow-hidden rounded-panel border app-border ${surface} ${sizeClass}`}
      style={sizeStyle}
    >
      {embed ? (
        <button
          type="button"
          onClick={() => onOpenEmbed(embed)}
          className="group absolute inset-0 h-full w-full cursor-pointer text-left"
          aria-label={`Play ${PROVIDER_LABEL[embed.provider]} video`}
        >
          <EmbedPoster embed={embed} />
        </button>
      ) : isImage ? (
        <button
          type="button"
          onClick={() => onOpenImage(item.url)}
          className="absolute inset-0 h-full w-full cursor-zoom-in"
          aria-label="Open image"
          onContextMenu={
            allowDownloads ? undefined : (event) => event.preventDefault()
          }
        >
          <OptimizedImage
            src={item.url}
            alt=""
            fill
            sizes={
              layout === "single"
                ? "(max-width: 768px) 100vw, 768px"
                : "(max-width: 640px) 100vw, 40vw"
            }
            className={`object-contain ${
              allowDownloads ? "" : "pointer-events-none select-none"
            }`}
            draggable={allowDownloads}
          />
        </button>
      ) : isVideo ? (
        <video
          src={item.url}
          controls
          controlsList={
            allowDownloads ? undefined : "nodownload noremoteplayback"
          }
          disablePictureInPicture={!allowDownloads}
          preload="metadata"
          className="absolute inset-0 h-full w-full object-contain"
          onContextMenu={
            allowDownloads ? undefined : (event) => event.preventDefault()
          }
        />
      ) : null}
    </article>
  );
}

function EmbedModal({
  embed,
  onClose,
}: {
  embed: VideoEmbed;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Instagram's card is much taller than the clip (header + caption +
  // comments), so it gets a fixed narrow, tall frame that scrolls internally.
  // Other providers keep a clean aspect box.
  const frameStyle =
    embed.provider === "instagram"
      ? { width: "min(420px, 95vw)", height: "85vh" }
      : embed.orientation === "portrait"
        ? { height: "85vh", aspectRatio: 9 / 16 }
        : { width: "min(56rem, 95vw)", aspectRatio: 16 / 9 };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute inset-0 h-full w-full cursor-zoom-out"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-black/80"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current" aria-hidden>
          <path
            d="M6 6l12 12M18 6L6 18"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </button>
      <div
        className="relative z-10 overflow-hidden rounded-2xl bg-black shadow-xl"
        style={frameStyle}
      >
        <iframe
          src={embed.embedUrl}
          title={`${PROVIDER_LABEL[embed.provider]} video`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}

export default function ProjectGallery({
  media,
  allowDownloads = true,
}: {
  media: ProjectMediaItem[];
  /**
   * When `false`, image right-click, drag, and the native video download
   * control are disabled. This is a deterrent only — anyone willing to
   * open DevTools can still grab the file. The page wrapper should pass
   * `true` for the owner so they can always download their own work.
   */
  allowDownloads?: boolean;
}) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [activeEmbed, setActiveEmbed] = useState<VideoEmbed | null>(null);
  const dictionary = useDictionary();

  if (media.length === 0) {
    return (
      <div className="rounded-hero app-panel-dashed p-8 text-sm app-muted">
        {dictionary.projectPage.noMedia}
      </div>
    );
  }

  // Layout adapts to item count so one clip gets a hero, two split, and a
  // richer set flows as even-height justified rows regardless of orientation.
  const layout: "single" | "duo" | "rows" =
    media.length === 1 ? "single" : media.length === 2 ? "duo" : "rows";

  const containerClass =
    layout === "single"
      ? "flex justify-center"
      : layout === "duo"
        ? "grid grid-cols-1 items-start gap-4 sm:grid-cols-2"
        : "flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center";

  return (
    <>
      <div className={containerClass}>
        {media.map((item) => (
          <GalleryItem
            key={item.id}
            item={item}
            layout={layout}
            allowDownloads={allowDownloads}
            onOpenImage={setActiveImage}
            onOpenEmbed={setActiveEmbed}
          />
        ))}
      </div>

      {activeEmbed && (
        <EmbedModal embed={activeEmbed} onClose={() => setActiveEmbed(null)} />
      )}

      {activeImage && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-6"
          onClick={() => setActiveImage(null)}
          onContextMenu={
            allowDownloads ? undefined : (event) => event.preventDefault()
          }
          aria-label="Close preview"
        >
          <OptimizedImage
            src={activeImage}
            alt=""
            width={1600}
            height={1200}
            className={`max-h-[90vh] max-w-[90vw] rounded-3xl object-contain ${
              allowDownloads ? "" : "pointer-events-none select-none"
            }`}
            draggable={allowDownloads}
          />
        </button>
      )}
    </>
  );
}
