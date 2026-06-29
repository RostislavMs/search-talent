"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDictionary } from "@/lib/i18n/client";
import OptimizedImage from "@/components/ui/optimized-image";
import { apiFetch } from "@/lib/api-client";
import { compressImageFile } from "@/lib/image-compression";
import { createClient } from "@/lib/supabase/client";
import { uploadWithProgress } from "@/lib/storage/upload-with-progress";

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
  const router = useRouter();

  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setErrorMessage(null);

      const rawFile = event.target.files?.[0];
      if (!rawFile) {
        return;
      }

      const file = await compressImageFile(rawFile, "avatar");
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
      // Re-render the server layout so the header (and any other server
      // component reading the profile) picks up the new avatar URL.
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : dictionary.dashboardProfile.avatarUploadFailed,
      );
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border app-border bg-[color:var(--surface-muted)] text-2xl font-semibold text-[color:var(--foreground)]">
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
        </div>

        <div>
          <p className="text-sm font-medium text-[color:var(--foreground)]">
            {dictionary.dashboardProfile.currentAvatar}
          </p>
          <p className="mt-1 hidden text-sm app-muted sm:block">
            {dictionary.dashboardProfile.avatarHint}
          </p>
        </div>
      </div>

      <label className="inline-flex cursor-pointer items-center rounded-full border app-border bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)]">
        <span>{dictionary.dashboardProfile.uploadAvatar}</span>
        <input
          type="file"
          accept="image/*"
          onChange={uploadAvatar}
          disabled={uploading}
          className="sr-only"
        />
      </label>

      {uploading && (
        <p className="mt-3 text-sm app-muted">
          {dictionary.dashboardProfile.uploading}
        </p>
      )}

      {errorMessage && <p className="text-sm text-rose-500">{errorMessage}</p>}
    </div>
  );
}
