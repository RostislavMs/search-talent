import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteFromR2, isR2Url } from "@/lib/storage/r2";

export type StorageProvider = "r2" | "supabase";

export function detectStorageProvider(url: string | null | undefined): StorageProvider {
  return isR2Url(url) ? "r2" : "supabase";
}

type DeleteOptions = {
  supabase: SupabaseClient;
  bucket: string;
  url: string | null;
  storagePath: string | null;
};

/**
 * Provider-aware deletion. New uploads go to R2; legacy files remain in
 * Supabase Storage. The `url` decides which backend to delete from, the
 * `storagePath` is the object key for whichever backend that is.
 */
export async function deleteStorageObject({
  supabase,
  bucket,
  url,
  storagePath,
}: DeleteOptions): Promise<{ error: { message: string } | null }> {
  if (!storagePath) {
    return { error: null };
  }

  const provider = detectStorageProvider(url);

  if (provider === "r2") {
    try {
      await deleteFromR2(storagePath);
      return { error: null };
    } catch (error) {
      return {
        error: {
          message:
            error instanceof Error ? error.message : "Failed to delete from R2",
        },
      };
    }
  }

  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  return { error: error ? { message: error.message } : null };
}
