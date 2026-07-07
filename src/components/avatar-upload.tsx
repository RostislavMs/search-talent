"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useDictionary } from "@/lib/i18n/client";
import OptimizedImage from "@/components/ui/optimized-image";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { compressImageFile } from "@/lib/image-compression";
import { createClient } from "@/lib/supabase/client";
import { uploadWithProgress } from "@/lib/storage/upload-with-progress";

// Size of the round crop window rendered inside the editor, in CSS px.
const CROP = 288;
// Edge length of the exported avatar bitmap. Matches the "avatar" compression
// preset so the crop is never up- or down-scaled twice.
const OUTPUT = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type Offset = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function AvatarUpload({
  userId,
  currentAvatarUrl,
  fallbackText,
}: {
  userId: string;
  currentAvatarUrl: string | null;
  fallbackText: string;
}) {
  const supabase = createClient();
  const dictionary = useDictionary();
  const editorUi = dictionary.dashboardProfile.avatarEditor;
  const router = useRouter();

  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editor modal state.
  const [modalOpen, setModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragActive, setDragActive] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const dragStateRef = useRef<{
    pointerX: number;
    pointerY: number;
    startOffset: Offset;
  } | null>(null);

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const resetEditor = useCallback(() => {
    releaseObjectUrl();
    setImageSrc(null);
    setNatural(null);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setDragActive(false);
    dragStateRef.current = null;
  }, [releaseObjectUrl]);

  const closeModal = useCallback(() => {
    if (uploading) {
      return;
    }
    setModalOpen(false);
    resetEditor();
  }, [uploading, resetEditor]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [modalOpen, closeModal]);

  useEffect(() => releaseObjectUrl, [releaseObjectUrl]);

  // When rotated a quarter turn, width and height swap for the "cover" fit.
  const effective = useMemo(() => {
    if (!natural) {
      return null;
    }
    const quarterTurned = rotation % 180 !== 0;
    return {
      w: quarterTurned ? natural.h : natural.w,
      h: quarterTurned ? natural.w : natural.h,
    };
  }, [natural, rotation]);

  // Smallest scale that still fully covers the round crop window.
  const baseScale = useMemo(() => {
    if (!effective) {
      return 1;
    }
    return Math.max(CROP / effective.w, CROP / effective.h);
  }, [effective]);

  const scale = baseScale * zoom;

  const clampOffset = useCallback(
    (next: Offset, atScale: number): Offset => {
      if (!effective) {
        return { x: 0, y: 0 };
      }
      const maxX = Math.max(0, (effective.w * atScale - CROP) / 2);
      const maxY = Math.max(0, (effective.h * atScale - CROP) / 2);
      return {
        x: clamp(next.x, -maxX, maxX),
        y: clamp(next.y, -maxY, maxY),
      };
    },
    [effective],
  );

  const loadFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) {
        return;
      }
      if (!file.type.startsWith("image/")) {
        setErrorMessage(editorUi.invalidType);
        return;
      }

      setErrorMessage(null);
      releaseObjectUrl();

      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;

      const image = new Image();
      image.onload = () => {
        setNatural({ w: image.naturalWidth, h: image.naturalHeight });
        setZoom(1);
        setRotation(0);
        setOffset({ x: 0, y: 0 });
        setImageSrc(url);
      };
      image.onerror = () => {
        releaseObjectUrl();
        setErrorMessage(editorUi.invalidType);
      };
      image.src = url;
    },
    [editorUi.invalidType, releaseObjectUrl],
  );

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  const onZoomChange = (next: number) => {
    setZoom(next);
    setOffset((prev) => clampOffset(prev, baseScale * next));
  };

  const onRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    // A quarter turn changes the covered axis; recentring avoids gaps.
    setOffset({ x: 0, y: 0 });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!imageSrc) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startOffset: offset,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state) {
      return;
    }
    const next = {
      x: state.startOffset.x + (event.clientX - state.pointerX),
      y: state.startOffset.y + (event.clientY - state.pointerY),
    };
    setOffset(clampOffset(next, scale));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragStateRef.current = null;
    }
  };

  const renderCroppedFile = useCallback(async (): Promise<File | null> => {
    const image = imgRef.current;
    if (!image || !natural) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Mirror the CSS transform used in the preview: translate(offset) →
    // rotate → scale, about the crop centre, expressed in output pixels.
    const k = OUTPUT / CROP;
    ctx.translate(OUTPUT / 2, OUTPUT / 2);
    ctx.translate(offset.x * k, offset.y * k);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale * k, scale * k);
    ctx.drawImage(image, -natural.w / 2, -natural.h / 2, natural.w, natural.h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.92),
    );
    if (!blob) {
      return null;
    }

    return new File([blob], "avatar.webp", {
      type: "image/webp",
      lastModified: 0,
    });
  }, [natural, offset, rotation, scale]);

  const saveAvatar = async () => {
    try {
      setUploading(true);
      setErrorMessage(null);

      const cropped = await renderCroppedFile();
      if (!cropped) {
        throw new Error(dictionary.dashboardProfile.avatarUploadFailed);
      }

      const file = await compressImageFile(cropped, "avatar");
      const contentType = file.type || "image/webp";

      const presign = await apiFetch<{
        uploadUrl: string;
        publicUrl: string;
        storagePath: string;
      }>("/api/storage/presign", {
        method: "POST",
        body: {
          scope: "avatar",
          fileName: file.name,
          contentType,
          fileSize: file.size,
        },
      });

      if (!presign.ok) {
        throw new Error(
          presign.error || dictionary.dashboardProfile.avatarUploadFailed,
        );
      }

      // Stable key per user → the upload overwrites the previous avatar, so
      // there is nothing to clean up. The `?v=` query busts the CDN cache.
      await uploadWithProgress({
        url: presign.data.uploadUrl,
        file,
        contentType,
      });
      const versionedUrl = `${presign.data.publicUrl}?v=${Date.now()}`;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: versionedUrl })
        .eq("user_id", userId);

      if (profileError) {
        throw profileError;
      }

      setAvatarUrl(versionedUrl);
      setUploading(false);
      setModalOpen(false);
      resetEditor();
      // Re-render the server layout so the header (and any other server
      // component reading the profile) picks up the new avatar URL.
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : dictionary.dashboardProfile.avatarUploadFailed,
      );
      setUploading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-label={editorUi.changePhoto}
        className="group relative block h-20 w-20 shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)]"
      >
        <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border app-border bg-[color:var(--surface-muted)] text-2xl font-semibold text-[color:var(--foreground)] transition-shadow group-hover:shadow-[0_10px_30px_rgba(2,6,23,0.25)]">
          {avatarUrl ? (
            <OptimizedImage
              src={avatarUrl}
              alt={dictionary.dashboardProfile.currentAvatar}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <span>{fallbackText}</span>
          )}

          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[rgba(2,6,23,0.5)] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M3 9a2 2 0 0 1 2-2h1.5l1-1.5a2 2 0 0 1 1.66-.9h3.68a2 2 0 0 1 1.66.9L16.5 7H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          </span>

          {uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-[rgba(2,6,23,0.6)]">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            </span>
          ) : null}
        </span>

        {/* Always-visible affordance so the avatar reads as editable. */}
        <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[color:var(--surface)] bg-[color:var(--accent)] text-white shadow-sm transition-transform group-hover:scale-105">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </span>
      </button>

      {errorMessage && !modalOpen ? (
        <p className="mt-3 text-sm text-rose-500">{errorMessage}</p>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,23,0.55)] px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-editor-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-md rounded-panel border app-border bg-[color:var(--surface)] p-6 text-left shadow-[0_28px_90px_rgba(2,6,23,0.4)]">
            <h2
              id="avatar-editor-title"
              className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
            >
              {editorUi.title}
            </h2>

            {imageSrc ? (
              <div className="mt-5">
                <div
                  className="relative mx-auto touch-none select-none overflow-hidden rounded-full border app-border bg-[color:var(--surface-muted)]"
                  style={{ width: CROP, height: CROP, cursor: "grab" }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                    style={{
                      width: natural?.w,
                      height: natural?.h,
                      transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`,
                      transformOrigin: "center",
                    }}
                  />
                </div>

                <p className="mt-3 text-center text-xs app-muted">
                  {editorUi.reposition}
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm app-soft">{editorUi.zoom}</span>
                  <input
                    type="range"
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={zoom}
                    onChange={(event) =>
                      onZoomChange(Number(event.target.value))
                    }
                    className="h-1.5 w-full cursor-pointer accent-[color:var(--accent)]"
                    aria-label={editorUi.zoom}
                  />
                  <button
                    type="button"
                    onClick={onRotate}
                    aria-label={editorUi.rotate}
                    title={editorUi.rotate}
                    className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border app-border bg-[color:var(--surface)] text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)]"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      <path d="M21 3v5h-5" />
                    </svg>
                  </button>
                </div>

                {errorMessage ? (
                  <p className="mt-3 text-sm text-rose-500">{errorMessage}</p>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetEditor}
                    disabled={uploading}
                  >
                    {editorUi.chooseAnother}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={closeModal}
                      disabled={uploading}
                    >
                      {editorUi.cancel}
                    </Button>
                    <Button onClick={saveAvatar} disabled={uploading}>
                      {uploading ? editorUi.saving : editorUi.save}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={onDrop}
                  className={`mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${
                    dragActive
                      ? "border-[color:var(--accent)] bg-[color:var(--surface-muted)]"
                      : "app-border bg-[color:var(--surface-muted)] hover:border-[color:var(--accent)]"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-8 w-8 app-soft"
                    aria-hidden="true"
                  >
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 20h14" />
                  </svg>
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {dragActive ? editorUi.dropActive : editorUi.dropTitle}
                  </p>
                  <p className="text-xs app-muted">
                    {editorUi.dropOr}{" "}
                    <span className="font-medium text-[color:var(--accent)] underline">
                      {editorUi.browse}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] app-soft">
                    {editorUi.formatsHint}
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => loadFile(event.target.files?.[0])}
                    className="sr-only"
                  />
                </label>

                {errorMessage ? (
                  <p className="mt-3 text-sm text-rose-500">{errorMessage}</p>
                ) : null}

                <div className="mt-6 flex justify-end">
                  <Button variant="ghost" onClick={closeModal}>
                    {editorUi.cancel}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
