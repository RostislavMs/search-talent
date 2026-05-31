/**
 * PUT a Blob/File to a presigned URL while emitting upload progress.
 *
 * Native `fetch()` does not expose upload progress in any browser today
 * (only download progress via ReadableStream). For large video uploads
 * (hundreds of MB) the user needs feedback, so we drop down to XHR.
 *
 * Resolves on 2xx, rejects on network error / abort / non-2xx response.
 */

export type UploadProgress = {
  /** Bytes transferred so far. */
  loaded: number;
  /** Total bytes to transfer (file size). */
  total: number;
  /** 0–100 integer percentage, suitable for direct display. */
  percent: number;
};

export type UploadWithProgressOptions = {
  url: string;
  file: Blob;
  contentType: string;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

export function uploadWithProgress({
  url,
  file,
  contentType,
  onProgress,
  signal,
}: UploadWithProgressOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      const total = event.lengthComputable ? event.total : file.size;
      const loaded = event.loaded;
      const percent =
        total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      onProgress({ loaded, total, percent });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Final 100% notification — `onprogress` does not always fire for
        // the last chunk, so callers can rely on this to flip the UI to
        // "done" without a stuck 99%.
        onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException("Upload aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}
