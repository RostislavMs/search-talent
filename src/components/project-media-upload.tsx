"use client";

import { startTransition, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import OptimizedImage from "@/components/ui/optimized-image";
import { apiFetch } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import { compressImageFile } from "@/lib/image-compression";
import {
  formatFileSize,
  inferProjectMediaKind,
  sanitizeStorageFileName,
  type ProjectMediaItem,
} from "@/lib/project-media";

const maxImageSize = 10 * 1024 * 1024;
const maxVideoSize = 150 * 1024 * 1024;
const maxFileSize = 50 * 1024 * 1024;

function getAllowedSize(kind: ProjectMediaItem["media_kind"]) {
  switch (kind) {
    case "image":
      return maxImageSize;
    case "video":
      return maxVideoSize;
    default:
      return maxFileSize;
  }
}

function getFileLabel(item: ProjectMediaItem) {
  return item.file_name || item.url.split("/").pop() || item.url;
}

function getFileExtension(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.at(-1)?.toUpperCase() || "FILE" : "FILE";
}

export default function ProjectMediaUpload({
  projectId,
  initialMedia = [],
  initialCoverUrl = null,
}: {
  projectId: string;
  initialMedia?: ProjectMediaItem[];
  initialCoverUrl?: string | null;
}) {
  const supabase = createClient();
  const router = useLocalizedRouter();
  const dictionary = useDictionary();
  const [mediaItems, setMediaItems] = useState<ProjectMediaItem[]>(initialMedia);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const syncServerState = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const uploadedItems: ProjectMediaItem[] = [];
      let nextCoverUrl = coverUrl;

      for (const rawFile of files) {
        const initialKind = inferProjectMediaKind(rawFile.type, rawFile.name);
        const file =
          initialKind === "image"
            ? await compressImageFile(rawFile, "inline")
            : rawFile;
        const mediaKind = inferProjectMediaKind(file.type, file.name);
        const maxSize = getAllowedSize(mediaKind);

        if (file.size > maxSize) {
          throw new Error(dictionary.dashboardProjects.fileTooLarge);
        }

        const filePath = `${projectId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeStorageFileName(file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from("project-media")
          .upload(filePath, file, { contentType: file.type });

        if (uploadError) {
          throw uploadError;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("project-media").getPublicUrl(filePath);

        const uploadResult = await apiFetch<{
          coverUrl?: string | null;
          media?: ProjectMediaItem;
        }>("/project-media", {
          method: "POST",
          body: {
            projectId,
            url: publicUrl,
            storagePath: filePath,
            fileName: file.name,
            mimeType: file.type || null,
            fileSize: file.size,
            mediaKind,
          },
        });

        if (!uploadResult.ok || !uploadResult.data.media) {
          await supabase.storage.from("project-media").remove([filePath]);
          throw new Error(
            uploadResult.ok
              ? dictionary.dashboardProjects.uploadFailed
              : uploadResult.error || dictionary.dashboardProjects.uploadFailed,
          );
        }

        uploadedItems.push(uploadResult.data.media);
        nextCoverUrl = uploadResult.data.coverUrl ?? nextCoverUrl;
      }

      setMediaItems((prev) => [...prev, ...uploadedItems]);
      setCoverUrl(nextCoverUrl);
      syncServerState();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : dictionary.dashboardProjects.uploadFailed,
      );
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  };

  const setAsCover = async (mediaId: string) => {
    setErrorMessage(null);

    const result = await apiFetch<{ coverUrl?: string | null }>(
      "/project-media",
      {
        method: "PATCH",
        body: { projectId, mediaId },
      },
    );

    if (!result.ok) {
      setErrorMessage(result.error || dictionary.dashboardProjects.coverFailed);
      return;
    }

    setCoverUrl(result.data.coverUrl ?? null);
    syncServerState();
  };

  const requestRemoveFile = (mediaId: string) => {
    setDeleteError(null);
    setPendingDeleteId(mediaId);
  };

  const cancelRemoveFile = () => {
    if (deleting) return;
    setPendingDeleteId(null);
    setDeleteError(null);
  };

  const confirmRemoveFile = async () => {
    if (!pendingDeleteId) return;
    const mediaId = pendingDeleteId;

    setDeleting(true);
    setDeleteError(null);

    try {
      const result = await apiFetch<{ coverUrl?: string | null }>(
        "/project-media",
        {
          method: "DELETE",
          body: { projectId, mediaId },
        },
      );

      if (!result.ok) {
        setDeleteError(
          result.error || dictionary.dashboardProjects.deleteFileFailed,
        );
        return;
      }

      setMediaItems((prev) => prev.filter((item) => item.id !== mediaId));
      setCoverUrl(result.data.coverUrl ?? null);
      setPendingDeleteId(null);
      syncServerState();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : dictionary.dashboardProjects.deleteFileFailed,
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-panel app-panel p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
            {dictionary.dashboardProjects.filesTitle}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 app-muted">
            {dictionary.dashboardProjects.filesDescription}
          </p>
        </div>

        {coverUrl && (
          <span className="rounded-full border app-border px-3 py-1 text-xs font-medium app-muted">
            {dictionary.dashboardProjects.previewReady}
          </span>
        )}
      </div>

      <div className="mt-5 rounded-3xl border border-dashed app-border bg-[color:var(--surface)] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              {dictionary.dashboardProjects.uploadMedia}
            </p>
            <p className="mt-1 text-sm app-muted">
              {dictionary.dashboardProjects.supportedFiles}
            </p>
          </div>

          <label className="inline-flex cursor-pointer items-center rounded-full border app-border bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)]">
            <span>
              {uploading
                ? dictionary.dashboardProjects.uploading
                : dictionary.dashboardProjects.chooseFiles}
            </span>
            <input
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.fig,.psd,.ai,.txt"
              onChange={upload}
              disabled={uploading}
              className="sr-only"
            />
          </label>
        </div>

        <p className="mt-3 text-xs app-soft">
          {dictionary.dashboardProjects.filesLimits}
        </p>
      </div>

      {errorMessage && <p className="mt-4 text-sm text-rose-500">{errorMessage}</p>}

      {mediaItems.length === 0 ? (
        <div className="mt-5 rounded-3xl app-panel-dashed p-6 text-sm app-muted">
          {dictionary.dashboardProjects.noFiles}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {mediaItems.map((item) => {
            const isCover = coverUrl === item.url;
            const fileLabel = getFileLabel(item);

            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-3xl border app-border bg-[color:var(--surface)]"
              >
                <div className="relative aspect-[16/10] bg-[color:var(--surface-muted)]">
                  {item.media_kind === "image" ? (
                    <OptimizedImage
                      src={item.url}
                      alt={fileLabel}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover"
                    />
                  ) : item.media_kind === "video" ? (
                    <video
                      src={item.url}
                      controls
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-6">
                      <div className="flex h-24 w-24 items-center justify-center rounded-3xl border app-border bg-[color:var(--surface)] text-lg font-semibold text-[color:var(--foreground)] shadow-sm">
                        {getFileExtension(fileLabel)}
                      </div>
                    </div>
                  )}

                  {isCover && (
                    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                      {dictionary.dashboardProjects.previewBadge}
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[color:var(--foreground)]">
                        {fileLabel}
                      </p>
                      <p className="mt-1 text-sm capitalize app-muted">
                        {item.media_kind}
                        {item.file_size ? ` / ${formatFileSize(item.file_size)}` : ""}
                      </p>
                    </div>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border app-border px-3 py-1 text-xs font-medium app-muted transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
                    >
                      {dictionary.dashboardProjects.openFile}
                    </a>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.media_kind === "image" && !isCover && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setAsCover(item.id)}
                      >
                        {dictionary.dashboardProjects.makePreview}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => requestRemoveFile(item.id)}
                    >
                      {dictionary.dashboardProjects.deleteFile}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={dictionary.dashboardProjects.confirmDeleteFileTitle}
        description={dictionary.dashboardProjects.confirmDeleteFile}
        confirmLabel={dictionary.dashboardProjects.deleteFile}
        cancelLabel={dictionary.dashboardProjects.cancel}
        confirmVariant="primary"
        pending={deleting}
        pendingLabel={dictionary.dashboardProjects.uploading}
        errorMessage={deleteError}
        onCancel={cancelRemoveFile}
        onConfirm={() => void confirmRemoveFile()}
      />
    </section>
  );
}
