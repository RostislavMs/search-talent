"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// The three formats we let authors frame a cover into. Landscape is the
// recommended default because every project card renders covers in a
// landscape box — see StepMedia / project-card.tsx.
const PRESETS = [
  { key: "16:9", value: 16 / 9, recommended: true },
  { key: "1:1", value: 1, recommended: false },
  { key: "9:16", value: 9 / 16, recommended: false },
] as const;

const STAGE_MARGIN = 28; // px of dimmed "will be cropped" bleed around the frame
const OUTPUT_LONG_EDGE = 1600; // cap the exported crop; compression runs later

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// A dependency-free crop / zoom / pan editor. The bright rectangle is exactly
// what becomes the cover; the dimmed bleed around it shows what gets cut. The
// image is scaled to always cover the frame (no empty gaps), then panned within
// clamped bounds. On apply we map the frame back to source pixels and bake the
// crop into a fresh WebP file, so display everywhere is a plain <img>.
export default function CoverCropEditor({
  file,
  dictionary,
  onCancel,
  onConfirm,
}: {
  file: File;
  dictionary: Dictionary;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const dict = dictionary.forms;

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [avail, setAvail] = useState<{ w: number; h: number }>({
    w: 320,
    h: 360,
  });
  const [aspect, setAspect] = useState<number>(PRESETS[0].value);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  // Load the picked file once; keep the decoded element around for export.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Track the space available to the stage so the frame scales to the modal.
  useEffect(() => {
    const measure = () => {
      const w = stageWrapRef.current?.clientWidth ?? 320;
      const h = Math.min(Math.round(window.innerHeight * 0.5), 420);
      setAvail({ w: Math.max(200, w), h: Math.max(220, h) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const naturalRatio = natural ? natural.w / natural.h : 16 / 9;

  const geo = useMemo(() => {
    const maxWinW = Math.max(160, avail.w - STAGE_MARGIN * 2);
    const maxWinH = Math.max(160, avail.h - STAGE_MARGIN * 2);
    let winW = maxWinW;
    let winH = winW / aspect;
    if (winH > maxWinH) {
      winH = maxWinH;
      winW = winH * aspect;
    }
    // Base size at zoom 1 covers the frame on its tight axis.
    let bw: number;
    let bh: number;
    if (naturalRatio > aspect) {
      bh = winH;
      bw = winH * naturalRatio;
    } else {
      bw = winW;
      bh = winW / naturalRatio;
    }
    const dw = bw * zoom;
    const dh = bh * zoom;
    return {
      winW,
      winH,
      stageW: winW + STAGE_MARGIN * 2,
      stageH: winH + STAGE_MARGIN * 2,
      dw,
      dh,
      minX: winW - dw, // offsets live in [minX, 0] x [minY, 0]
      minY: winH - dh,
    };
  }, [avail.w, avail.h, aspect, zoom, naturalRatio]);

  // Re-center whenever the framing or the source image changes.
  useEffect(() => {
    setOffset({ x: geo.minX / 2, y: geo.minY / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, naturalRatio]);

  // Keep the pan valid when zoom / available size change.
  useEffect(() => {
    setOffset((o) => ({
      x: clamp(o.x, geo.minX, 0),
      y: clamp(o.y, geo.minY, 0),
    }));
  }, [geo.minX, geo.minY]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setOffset((o) => ({
      x: clamp(o.x + dx, geo.minX, 0),
      y: clamp(o.y + dy, geo.minY, 0),
    }));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // capture may already be released
    }
  };

  const reset = () => {
    setZoom(1);
    setOffset({ x: geo.minX / 2, y: geo.minY / 2 });
  };

  const handleApply = async () => {
    const img = imgRef.current;
    if (!img || !natural || busy) return;
    setBusy(true);
    try {
      const scale = natural.w / geo.dw; // source px per displayed px (uniform)
      const sx = clamp(-offset.x * scale, 0, natural.w);
      const sy = clamp(-offset.y * scale, 0, natural.h);
      const sW = clamp(geo.winW * scale, 1, natural.w - sx);
      const sH = clamp(geo.winH * scale, 1, natural.h - sy);

      const outScale = Math.min(1, OUTPUT_LONG_EDGE / Math.max(sW, sH));
      const outW = Math.max(1, Math.round(sW * outScale));
      const outH = Math.max(1, Math.round(sH * outScale));

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sW, sH, 0, 0, outW, outH);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.9),
      );
      if (!blob) throw new Error("toBlob failed");

      const cropped = new File([blob], `cover-${crypto.randomUUID()}.webp`, {
        type: "image/webp",
      });
      onConfirm(cropped);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={dict.coverEditorTitle}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border app-border bg-[color:var(--surface)] p-5">
        <h3 className="font-display text-base font-semibold tracking-tight text-[color:var(--foreground)]">
          {dict.coverEditorTitle}
        </h3>
        <p className="mt-1 text-sm app-muted">{dict.coverEditorHint}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => {
            const active = Math.abs(aspect - preset.value) < 0.001;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => setAspect(preset.value)}
                aria-pressed={active}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-transparent bg-[color:var(--brand)] text-[color:var(--brand-foreground)]"
                    : "app-border bg-[color:var(--surface)] app-muted hover:bg-[color:var(--surface-muted)]"
                }`}
              >
                {preset.key}
                {preset.recommended ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                      active
                        ? "bg-white/20"
                        : "bg-[color:var(--surface-muted)] app-soft"
                    }`}
                  >
                    {dict.coverEditorRecommended}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div ref={stageWrapRef} className="mt-4 flex justify-center">
          <div
            className="relative touch-none select-none overflow-hidden rounded-2xl bg-black"
            style={{
              width: geo.stageW,
              height: geo.stageH,
              cursor: "grab",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {objectUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
                alt=""
                draggable={false}
                className="pointer-events-none absolute max-w-none select-none"
                style={{
                  left: STAGE_MARGIN + offset.x,
                  top: STAGE_MARGIN + offset.y,
                  width: geo.dw,
                  height: geo.dh,
                }}
              />
            ) : null}

            {/* Bright crop window; the big spread shadow (clipped by the stage)
                dims everything outside it — i.e. what will be cropped away. */}
            <div
              className="pointer-events-none absolute rounded-lg ring-1 ring-white/70"
              style={{
                left: STAGE_MARGIN,
                top: STAGE_MARGIN,
                width: geo.winW,
                height: geo.winH,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs app-soft">{dict.coverEditorZoom}</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-[color:var(--accent)]"
            aria-label={dict.coverEditorZoom}
          />
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer text-xs app-muted underline-offset-2 hover:underline"
          >
            {dict.coverEditorReset}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {dict.coverEditorCancel}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={busy || !natural}
          >
            {busy ? dict.coverEditorProcessing : dict.coverEditorApply}
          </Button>
        </div>
      </div>
    </div>
  );
}
