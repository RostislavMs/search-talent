"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { compressImageFile } from "@/lib/image-compression";
import {
  checkAttachmentFile,
  isMessageAttachmentType,
  MESSAGE_ATTACHMENTS_PER_MESSAGE,
  type MessageAttachmentType,
} from "@/lib/message-attachments";
import { newClientId, toRefusalCode, type MessageRefusalCode } from "@/lib/messages";
import { uploadWithProgress } from "@/lib/storage/upload-with-progress";

/** A file in the box before the message goes out. */
export type AttachmentDraft = {
  /** Local, for React and for removing it. */
  key: string;
  name: string;
  type: MessageAttachmentType;
  size: number;
  /** A local preview of an image while it uploads. */
  previewUrl: string | null;
  status: "preparing" | "uploading" | "ready" | "failed";
  progress: number;
  /** The server's id once it gave one. */
  attachmentId: string | null;
  error: MessageRefusalCode | null;
};

type Rejected = { name: string; code: "file_type" | "file_empty" | "file_too_large" | "too_many_files" };

async function imageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  if (typeof createImageBitmap !== "function") return { width: null, height: null };
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width || null, height: bitmap.height || null };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

/** A camera photo far over the limit is still fine: it is re-encoded before upload. */
const RAW_IMAGE_MAX_BYTES = 50 * 1024 * 1024;

function precheck(file: File): "file_type" | "file_empty" | "file_too_large" | null {
  if (!file.type.startsWith("image/")) return checkAttachmentFile(file);
  if (!isMessageAttachmentType(file.type)) return "file_type";
  if (file.size < 1) return "file_empty";
  return file.size > RAW_IMAGE_MAX_BYTES ? "file_too_large" : null;
}

function previewOf(file: File): string | null {
  return file.type.startsWith("image/") && typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
}

/**
 * The files of the message being written: each is prepared (an image is
 * re-encoded, which drops its camera metadata), checked by the database,
 * uploaded straight into the private bucket and read back by the server
 * before it can be sent. Removing one cancels its upload and tells the
 * server; leaving the conversation cancels what is still going.
 */
export function useMessageAttachments(conversationId: string) {
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  const originals = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const draftsRef = useRef(drafts);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  const update = useCallback((key: string, patch: Partial<AttachmentDraft>) => {
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  }, []);

  const discardOnServer = useCallback(
    (attachmentId: string | null) => {
      if (!attachmentId) return;
      void apiFetch(`/api/messages/conversations/${conversationId}/attachments/${attachmentId}`, { method: "DELETE" });
    },
    [conversationId],
  );

  const upload = useCallback(
    async (key: string, original: File) => {
      const controller = new AbortController();
      controllers.current.set(key, controller);
      let attachmentId: string | null = null;

      try {
        let file = original;
        let width: number | null = null;
        let height: number | null = null;

        if (original.type.startsWith("image/")) {
          file = await compressImageFile(original, "message");
          ({ width, height } = await imageSize(file));
        }

        const problem = checkAttachmentFile(file);
        if (problem || !isMessageAttachmentType(file.type)) {
          throw problem ?? "file_type";
        }
        if (controller.signal.aborted) return;

        update(key, { status: "uploading", name: file.name, type: file.type, size: file.size, progress: 0 });

        const created = await apiFetch<{ attachmentId: string; uploadUrl: string }>(
          `/api/messages/conversations/${conversationId}/attachments`,
          {
            method: "POST",
            body: { fileName: file.name, contentType: file.type, size: file.size, width, height },
            signal: controller.signal,
          },
        );
        if (!created.ok) throw toRefusalCode(created.code);

        attachmentId = created.data.attachmentId;
        update(key, { attachmentId });

        await uploadWithProgress({
          url: created.data.uploadUrl,
          file,
          contentType: file.type,
          signal: controller.signal,
          onProgress: (progress) => update(key, { progress: progress.percent }),
        });

        const confirmed = await apiFetch(`/api/messages/conversations/${conversationId}/attachments/${attachmentId}`, {
          method: "POST",
          signal: controller.signal,
        });
        if (!confirmed.ok) throw toRefusalCode(confirmed.code);

        update(key, { status: "ready", progress: 100 });
      } catch (error) {
        if (controller.signal.aborted) return;
        discardOnServer(attachmentId);
        update(key, {
          status: "failed",
          attachmentId: null,
          error: typeof error === "string" ? toRefusalCode(error) : "failed",
        });
      } finally {
        if (controllers.current.get(key) === controller) controllers.current.delete(key);
      }
    },
    [conversationId, discardOnServer, update],
  );

  /** Adds picked, pasted or dropped files; returns the ones that cannot go. */
  const add = useCallback(
    (files: File[]): Rejected[] => {
      const rejected: Rejected[] = [];
      const room = MESSAGE_ATTACHMENTS_PER_MESSAGE - draftsRef.current.length;
      const accepted: AttachmentDraft[] = [];

      for (const file of files) {
        const problem = precheck(file);
        if (problem) {
          rejected.push({ name: file.name, code: problem });
          continue;
        }
        if (accepted.length >= room) {
          rejected.push({ name: file.name, code: "too_many_files" });
          continue;
        }

        const key = newClientId();
        originals.current.set(key, file);
        accepted.push({
          key,
          name: file.name,
          type: file.type as MessageAttachmentType,
          size: file.size,
          previewUrl: previewOf(file),
          status: "preparing",
          progress: 0,
          attachmentId: null,
          error: null,
        });
      }

      if (accepted.length > 0) {
        setDrafts((current) => [...current, ...accepted]);
        for (const draft of accepted) {
          void upload(draft.key, originals.current.get(draft.key)!);
        }
      }

      return rejected;
    },
    [upload],
  );

  const remove = useCallback(
    (key: string) => {
      const draft = draftsRef.current.find((item) => item.key === key);
      controllers.current.get(key)?.abort();
      controllers.current.delete(key);
      originals.current.delete(key);
      if (draft) {
        discardOnServer(draft.attachmentId);
        if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      }
      setDrafts((current) => current.filter((item) => item.key !== key));
    },
    [discardOnServer],
  );

  const retry = useCallback(
    (key: string) => {
      const original = originals.current.get(key);
      if (!original) return;
      update(key, { status: "preparing", progress: 0, error: null, attachmentId: null });
      void upload(key, original);
    },
    [update, upload],
  );

  /**
   * Hands the uploaded files to a message and empties the box. The previews
   * stay valid; release them with releasePreviews() once they are not shown.
   */
  const take = useCallback((): AttachmentDraft[] => {
    const taken = draftsRef.current.filter((draft) => draft.status === "ready");
    for (const draft of taken) originals.current.delete(draft.key);
    setDrafts((current) => current.filter((draft) => draft.status !== "ready"));
    return taken;
  }, []);

  // Leaving the conversation: stop the uploads, free the previews.
  useEffect(() => {
    const running = controllers.current;
    return () => {
      for (const controller of running.values()) controller.abort();
      for (const draft of draftsRef.current) {
        if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      }
    };
  }, []);

  const busy = drafts.some((draft) => draft.status === "preparing" || draft.status === "uploading");
  const ready = drafts.filter((draft) => draft.status === "ready");
  const failed = drafts.some((draft) => draft.status === "failed");

  return { drafts, ready, busy, failed, add, remove, retry, take };
}

export function releasePreviews(drafts: Array<Pick<AttachmentDraft, "previewUrl">>) {
  for (const draft of drafts) {
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
  }
}
