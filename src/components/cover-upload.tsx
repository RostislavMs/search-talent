"use client";

import { useState } from "react";
import OptimizedImage from "@/components/ui/optimized-image";
import { useToast } from "@/components/ui/toast";
import { compressImageFile } from "@/lib/image-compression";
import { useDictionary } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";

const COVER_BUCKET = "profile-covers";

function extractCoverStoragePath(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    const marker = `/storage/v1/object/public/${COVER_BUCKET}/`;
    const markerIndex = parsedUrl.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    return decodeURIComponent(
      parsedUrl.pathname.slice(markerIndex + marker.length),
    );
  } catch {
    return null;
  }
}

export default function CoverUpload({
  userId,
  currentCoverUrl,
}: {
  userId: string;
  currentCoverUrl: string | null;
}) {
  const supabase = createClient();
  const dictionary = useDictionary();
  const toast = useToast();
  const ui = dictionary.dashboardProfile.cover;

  const [coverUrl, setCoverUrl] = useState(currentCoverUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = event.target.files?.[0];

    if (!rawFile) {
      return;
    }

    try {
      setUploading(true);

      const file = await compressImageFile(rawFile, "cover");
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "webp";
      const filePath = `${userId}/cover.${fileExt}`;
      const previousPath = extractCoverStoragePath(coverUrl);

      const { error: uploadError } = await supabase.storage
        .from(COVER_BUCKET)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(COVER_BUCKET).getPublicUrl(filePath);
      const versionedUrl = `${publicUrl}?v=${Date.now()}`;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ cover_url: versionedUrl })
        .eq("user_id", userId);

      if (profileError) {
        throw profileError;
      }

      if (previousPath && previousPath !== filePath) {
        await supabase.storage.from(COVER_BUCKET).remove([previousPath]);
      }

      setCoverUrl(versionedUrl);
      toast.success(ui.uploadedMessage);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : ui.uploadFailedMessage,
      );
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!coverUrl) {
      return;
    }

    try {
      setRemoving(true);

      const previousPath = extractCoverStoragePath(coverUrl);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ cover_url: null })
        .eq("user_id", userId);

      if (profileError) {
        throw profileError;
      }

      if (previousPath) {
        await supabase.storage.from(COVER_BUCKET).remove([previousPath]);
      }

      setCoverUrl(null);
      toast.success(ui.removedMessage);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : ui.removeFailedMessage,
      );
    } finally {
      setRemoving(false);
    }
  };

  const busy = uploading || removing;

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[color:var(--foreground)]">
            {ui.title}
          </p>
          <p className="mt-1 text-sm app-muted">{ui.hint}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label
            className={[
              "inline-flex items-center rounded-full border app-border bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition",
              busy
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:bg-[color:var(--surface-muted)]",
            ].join(" ")}
          >
            <span>
              {coverUrl ? ui.replaceAction : ui.uploadAction}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              disabled={busy}
              className="sr-only"
            />
          </label>

          {coverUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="inline-flex cursor-pointer items-center rounded-full border app-border bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ui.removeAction}
            </button>
          )}
        </div>
      </div>

      <div className="relative aspect-[16/5] w-full overflow-hidden rounded-[1.5rem] border app-border bg-[color:var(--surface-muted)]">
        {coverUrl ? (
          <OptimizedImage
            src={coverUrl}
            alt={ui.previewAlt}
            fill
            sizes="(max-width: 768px) 100vw, 1280px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm app-muted">
            {ui.empty}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-[color:var(--background)]/70 text-sm app-muted">
            {uploading ? ui.uploading : ui.removing}
          </div>
        )}
      </div>
    </section>
  );
}
