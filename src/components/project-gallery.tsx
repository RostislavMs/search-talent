"use client";

import { useEffect, useState } from "react";
import { useDictionary } from "@/lib/i18n/client";
import {
  buildYouTubeEmbedUrl,
  getYouTubeVideoId,
  type ProjectMediaItem,
} from "@/lib/project-media";
import OptimizedImage from "@/components/ui/optimized-image";

const DEFAULT_ASPECT_RATIO = 16 / 10;

function clampAspect(ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return DEFAULT_ASPECT_RATIO;
  return Math.min(Math.max(ratio, 0.5), 2.4);
}

function useImageAspect(src: string) {
  const [ratio, setRatio] = useState<number>(DEFAULT_ASPECT_RATIO);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const next =
        img.naturalWidth && img.naturalHeight
          ? img.naturalWidth / img.naturalHeight
          : DEFAULT_ASPECT_RATIO;
      setRatio(clampAspect(next));
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return ratio;
}

function useVideoAspect(src: string) {
  const [ratio, setRatio] = useState<number>(DEFAULT_ASPECT_RATIO);

  useEffect(() => {
    let cancelled = false;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (cancelled) return;
      const next =
        video.videoWidth && video.videoHeight
          ? video.videoWidth / video.videoHeight
          : DEFAULT_ASPECT_RATIO;
      setRatio(clampAspect(next));
    };
    video.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return ratio;
}

function ImageTile({
  src,
  onOpen,
  allowDownloads,
}: {
  src: string;
  onOpen: () => void;
  allowDownloads: boolean;
}) {
  const aspectRatio = useImageAspect(src);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full cursor-zoom-in text-left"
      aria-label="Open image"
    >
      <div
        className="relative w-full bg-[color:var(--surface-muted)]"
        style={{ aspectRatio }}
        onContextMenu={
          allowDownloads ? undefined : (event) => event.preventDefault()
        }
      >
        <OptimizedImage
          src={src}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 33vw"
          className={`object-contain transition duration-300 ${
            allowDownloads ? "" : "pointer-events-none select-none"
          }`}
          draggable={allowDownloads}
        />
      </div>
    </button>
  );
}

function VideoTile({
  src,
  allowDownloads,
}: {
  src: string;
  allowDownloads: boolean;
}) {
  const aspectRatio = useVideoAspect(src);

  return (
    <div
      className="relative w-full bg-[color:var(--surface-muted)]"
      style={{ aspectRatio }}
      onContextMenu={
        allowDownloads ? undefined : (event) => event.preventDefault()
      }
    >
      <video
        src={src}
        controls
        controlsList={allowDownloads ? undefined : "nodownload noremoteplayback"}
        disablePictureInPicture={!allowDownloads}
        preload="metadata"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function YouTubeTile({ videoId }: { videoId: string }) {
  return (
    <div className="relative w-full bg-black" style={{ aspectRatio: 16 / 9 }}>
      <iframe
        src={buildYouTubeEmbedUrl(videoId)}
        title="YouTube video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
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
  const dictionary = useDictionary();

  if (media.length === 0) {
    return (
      <div className="rounded-hero app-panel-dashed p-8 text-sm app-muted">
        {dictionary.projectPage.noMedia}
      </div>
    );
  }

  return (
    <>
      {/*
        Masonry-style layout via CSS columns. Each tile keeps its natural
        aspect ratio (no cropping), and items slot into the shortest column
        below the previous one — so landscape photos never sit beside a
        tall portrait with empty space below them. `break-inside-avoid`
        keeps each card from being split across columns, `gap-y` controls
        vertical spacing inside a column.
      */}
      <div className="gap-4 [column-fill:balance] columns-1 sm:columns-2 lg:columns-3">
        {media.map((item) => {
          const youtubeId = getYouTubeVideoId(item.url);
          const isYouTube = youtubeId !== null;
          const isImage = !isYouTube && item.media_kind === "image";
          const isVideo = !isYouTube && item.media_kind === "video";

          return (
            <article
              key={item.id}
              className="mb-4 break-inside-avoid overflow-hidden rounded-panel border app-border bg-[color:var(--surface)]"
            >
              {isYouTube && youtubeId ? (
                <YouTubeTile videoId={youtubeId} />
              ) : isImage ? (
                <ImageTile
                  src={item.url}
                  onOpen={() => setActiveImage(item.url)}
                  allowDownloads={allowDownloads}
                />
              ) : isVideo ? (
                <VideoTile src={item.url} allowDownloads={allowDownloads} />
              ) : null}
            </article>
          );
        })}
      </div>

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
