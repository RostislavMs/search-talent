import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sniffAttachmentType } from "@/lib/message-attachments";
import { toRefusalCode, type MessageRefusalCode } from "@/lib/messages";
import { deleteFromPrivateR2, inspectPrivateObject } from "@/lib/storage/r2";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Files in messages (part 13.4). The database decides who may upload where,
 * the limits and who may open a file (the files migration); this module calls
 * it and does the one thing it cannot: read the stored object back from the
 * private bucket to tell its real size and type.
 */

type Refusal = { ok: false; code: MessageRefusalCode };

function refusal(status: unknown): Refusal {
  return { ok: false, code: toRefusalCode(status) };
}

/** A file about to be uploaded into this conversation: its id and storage key, or why not. */
export async function createMessageAttachment(
  supabase: SupabaseClient,
  conversationId: string,
  input: { fileName: string; contentType: string; size: number; width?: number | null; height?: number | null },
): Promise<{ ok: true; attachmentId: string; storageKey: string } | Refusal> {
  const { data, error } = await supabase.rpc("create_message_attachment", {
    p_conversation_id: conversationId,
    p_file_name: input.fileName,
    p_content_type: input.contentType,
    p_size: input.size,
    p_width: input.width ?? null,
    p_height: input.height ?? null,
  });

  if (error || !data || typeof data !== "object") {
    if (error) {
      console.error("[messages] attachment create failed:", error.message);
    }
    return refusal("failed");
  }

  const row = data as { status?: unknown; attachment_id?: unknown; storage_key?: unknown };

  if (row.status !== "ok" || typeof row.attachment_id !== "string" || typeof row.storage_key !== "string") {
    return refusal(row.status);
  }

  return { ok: true, attachmentId: row.attachment_id, storageKey: row.storage_key };
}

export function messageAttachmentKey(conversationId: string, attachmentId: string): string {
  return `messages/${conversationId}/${attachmentId}`;
}

/**
 * After the browser's upload: reads the object back (size, first bytes) and
 * lets the database accept it only when both match what was declared. A
 * mismatch erases the object at once. Never throws.
 */
export async function verifyMessageAttachment(
  userId: string,
  conversationId: string,
  attachmentId: string,
): Promise<{ ok: true } | Refusal> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[messages] SUPABASE_SERVICE_ROLE_KEY missing — files cannot be confirmed");
    return refusal("storage_unavailable");
  }

  const key = messageAttachmentKey(conversationId, attachmentId);

  let stored: Awaited<ReturnType<typeof inspectPrivateObject>>;
  try {
    stored = await inspectPrivateObject(key);
  } catch (error) {
    console.error("[messages] reading an upload back failed", { key, error });
    return refusal("storage_unavailable");
  }

  if (!stored) {
    return refusal("file_missing");
  }

  const { data, error } = await admin.rpc("confirm_message_attachment", {
    p_attachment_id: attachmentId,
    p_user_id: userId,
    p_storage_key: key,
    p_size: stored.size,
    p_content_type: sniffAttachmentType(stored.head),
  });

  if (error || !data || typeof data !== "object") {
    if (error) {
      console.error("[messages] attachment confirm failed:", error.message);
    }
    return refusal("failed");
  }

  const row = data as { status?: unknown; storage_key?: unknown };

  if (row.status === "file_mismatch") {
    await deleteFromPrivateR2(key).catch((deleteError: unknown) => {
      // The daily cron erases it with the other unsent ones.
      console.error("[messages] could not erase a refused upload", { key, error: deleteError });
    });
  }

  return row.status === "ok" ? { ok: true } : refusal(row.status);
}

/**
 * The sender took an unsent file out. Its object goes now when it can; the
 * database's daily cron erases whatever is left.
 */
export async function discardMessageAttachment(
  supabase: SupabaseClient,
  conversationId: string,
  attachmentId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("discard_message_attachment", { p_attachment_id: attachmentId });

  if (error || (data as { status?: unknown } | null)?.status !== "ok") {
    return false;
  }

  await deleteFromPrivateR2(messageAttachmentKey(conversationId, attachmentId)).catch(() => undefined);
  return true;
}

export type StoredAttachment = { storageKey: string; contentType: string; fileName: string };

function toStoredAttachment(data: unknown): StoredAttachment | null {
  const row = (data ?? null) as { status?: unknown; storage_key?: unknown; content_type?: unknown; file_name?: unknown } | null;

  if (
    !row ||
    row.status !== "ok" ||
    typeof row.storage_key !== "string" ||
    typeof row.content_type !== "string" ||
    typeof row.file_name !== "string"
  ) {
    return null;
  }

  return { storageKey: row.storage_key, contentType: row.content_type, fileName: row.file_name };
}

/** A file the caller may open (they see its message), or null. */
export async function getMessageAttachmentAccess(
  supabase: SupabaseClient,
  attachmentId: string,
): Promise<StoredAttachment | null> {
  const { data, error } = await supabase.rpc("message_attachment_access", { p_attachment_id: attachmentId });
  return error ? null : toStoredAttachment(data);
}

/**
 * A moderator opens a file from the report that holds it (logged by the
 * database). "forbidden" for anyone who is not a platform admin.
 */
export async function getReportedAttachment(
  supabase: SupabaseClient,
  reportId: string,
  attachmentId: string,
): Promise<StoredAttachment | "forbidden" | null> {
  const { data, error } = await supabase.rpc("admin_message_attachment", {
    p_report_id: reportId,
    p_attachment_id: attachmentId,
  });

  if (error) {
    return error.code === "42501" ? "forbidden" : null;
  }

  return toStoredAttachment(data);
}
