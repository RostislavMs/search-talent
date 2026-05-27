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
}: {
  src: string;
  onOpen: () => void;
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
      >
        <OptimizedImage
          src={src}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 33vw"
          className="object-contain transition duration-300"
        />
      </div>
    </button>
  );
}

function VideoTile({ src }: { src: string }) {
  const aspectRatio = useVideoAspect(src);

  return (
    <div
      className="relative w-full bg-[color:var(--surface-muted)]"
      style={{ aspectRatio }}
    >
      <video
        src={src}
        controls
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

export default function ProjectGallery({ media }: { media: ProjectMediaItem[] }) {
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {media.map((item) => {
          const youtubeId = getYouTubeVideoId(item.url);
          const isYouTube = youtubeId !== null;
          const isImage = !isYouTube && item.media_kind === "image";
          const isVideo = !isYouTube && item.media_kind === "video";

          return (
            <article
              key={item.id}
              className="overflow-hidden rounded-panel border app-border bg-[color:var(--surface)]"
            >
              {isYouTube && youtubeId ? (
                <YouTubeTile videoId={youtubeId} />
              ) : isImage ? (
                <ImageTile
                  src={item.url}
                  onOpen={() => setActiveImage(item.url)}
                />
              ) : isVideo ? (
                <VideoTile src={item.url} />
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
          aria-label="Close preview"
        >
          <OptimizedImage
            src={activeImage}
            alt=""
            width={1600}
            height={1200}
            className="max-h-[90vh] max-w-[90vw] rounded-3xl object-contain"
          />
        </button>
      )}
    </>
  );
}
