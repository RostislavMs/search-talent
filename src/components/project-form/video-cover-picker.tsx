"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  createPosterExtractor,
  type PosterExtractor,
} from "@/lib/video-poster";

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Preview-driven cover picker: the frame the author sees IS the frame that
// becomes the cover. A single hidden extractor (see @/lib/video-poster)
// captures at the scrubbed moment and we render its output as an <img>, so
// there is no reliance on a visible <video> painting the seeked frame.
export default function VideoCoverPicker({
  file,
  dictionary,
  onCancel,
  onConfirm,
}: {
  file: File;
  dictionary: Dictionary;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const dict = dictionary.forms;
  const extractorRef = useRef<PosterExtractor | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const requestRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showPreview = (blob: Blob) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const nextUrl = URL.createObjectURL(blob);
    previewUrlRef.current = nextUrl;
    blobRef.current = blob;
    setPreviewUrl(nextUrl);
  };

  useEffect(() => {
    const extractor = createPosterExtractor(file);
    extractorRef.current = extractor;
    let cancelled = false;

    (async () => {
      const dur = await extractor.ready.catch(() => 0);
      if (cancelled) return;
      setDuration(dur);
      const initial = dur ? Math.min(Math.max(dur * 0.1, 0.5), dur - 0.1) : 0;
      setTime(initial);
      const result = await extractor.capture(initial);
      if (cancelled) return;
      if (result) {
        showPreview(result.blob);
      } else {
        setError(dict.videoCoverPickerError);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      extractor.dispose();
    };
  }, [file, dict.videoCoverPickerError]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const handleScrub = (value: number) => {
    setTime(value);
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const requestId = ++requestRef.current;
    debounceRef.current = setTimeout(async () => {
      const extractor = extractorRef.current;
      if (!extractor) return;
      const result = await extractor.capture(value);
      if (requestId !== requestRef.current) return; // superseded by a newer scrub
      if (result) {
        showPreview(result.blob);
        setError(null);
      } else {
        setError(dict.videoCoverPickerError);
      }
      setLoading(false);
    }, 250);
  };

  const handleUse = () => {
    if (blobRef.current) {
      onConfirm(blobRef.current);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={dict.videoCoverPickerTitle}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border app-border bg-[color:var(--surface)] p-5">
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dict.videoCoverPickerTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">{dict.videoCoverPickerHint}</p>

        <div className="relative mt-4 flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-black">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : null}
          {loading ? (
            <span className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
              {dict.videoCoverPickerWorking}
            </span>
          ) : null}
        </div>

        {duration > 0 ? (
          <div className="mt-4 flex items-center gap-3">
            <span className="w-12 tabular-nums text-xs app-soft">
              {formatClock(time)}
            </span>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={time}
              onChange={(event) => handleScrub(Number(event.target.value))}
              className="h-1.5 flex-1 cursor-pointer accent-[color:var(--accent)]"
              aria-label={dict.videoCoverPickerTitle}
            />
            <span className="w-12 text-right tabular-nums text-xs app-soft">
              {formatClock(duration)}
            </span>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-rose-500" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {dict.videoCoverPickerCancel}
          </Button>
          <Button
            type="button"
            onClick={handleUse}
            disabled={loading || !previewUrl}
          >
            {dict.videoCoverPickerUse}
          </Button>
        </div>
      </div>
    </div>
  );
}
