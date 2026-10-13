/**
 * Files in messages (part 13.4, docs/messages.md). The database keeps the
 * rules — which conversations, how many, the limits — and this module only
 * holds what the browser and the routes share: the accepted types, the sizes,
 * telling a type from a file's first bytes, and the words around a file.
 */

export const MESSAGE_ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type MessageAttachmentType = (typeof MESSAGE_ATTACHMENT_TYPES)[number];

/** What the file picker offers. */
export const MESSAGE_ATTACHMENT_ACCEPT = MESSAGE_ATTACHMENT_TYPES.join(",");

export const MESSAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const MESSAGE_ATTACHMENTS_PER_MESSAGE = 5;
export const MESSAGE_ATTACHMENT_NAME_MAX = 120;

/** A file in a message, as both sides see it. */
export type MessageAttachment = {
  id: string;
  name: string;
  type: MessageAttachmentType;
  size: number;
  width: number | null;
  height: number | null;
};

export function isMessageAttachmentType(value: unknown): value is MessageAttachmentType {
  return MESSAGE_ATTACHMENT_TYPES.includes(value as MessageAttachmentType);
}

export function isImageAttachment(attachment: Pick<MessageAttachment, "type">): boolean {
  return attachment.type.startsWith("image/");
}

function positiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeMessageAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): MessageAttachment[] => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
    if (!row || typeof row.id !== "string" || !isMessageAttachmentType(row.type)) return [];

    return [
      {
        id: row.id,
        name: typeof row.name === "string" && row.name !== "" ? row.name : "file",
        type: row.type,
        size: positiveInt(row.size) ?? 0,
        width: positiveInt(row.width),
        height: positiveInt(row.height),
      },
    ];
  });
}

/**
 * The type a file really is, from its first bytes; null for anything that is
 * not one of the accepted types. The browser's word for a file is not
 * trusted: an HTML page renamed to .pdf is still HTML.
 */
export function sniffAttachmentType(bytes: Uint8Array): MessageAttachmentType | null {
  const startsWith = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length && signature.every((byte, index) => bytes[offset + index] === byte);

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF" <size> "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  // "%PDF-"
  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

/** Why a picked file cannot go, before anything is uploaded; null when it can. */
export function checkAttachmentFile(file: { type: string; size: number }): "file_type" | "file_empty" | "file_too_large" | null {
  if (!isMessageAttachmentType(file.type)) return "file_type";
  if (file.size < 1) return "file_empty";
  if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES) return "file_too_large";
  return null;
}

/** Where a file opens: our route checks the caller and sends them to a short-lived link. */
export function buildAttachmentHref(id: string, download = false): string {
  return `/api/messages/attachments/${id}${download ? "?download=1" : ""}`;
}

/** A moderator opens a file from the report that holds it. */
export function buildAdminAttachmentHref(id: string, reportId: string): string {
  return `/api/admin/message-attachments/${id}?report=${encodeURIComponent(reportId)}`;
}

/** "840 KB", "2.4 MB" (or "2,4 МБ"). */
export function formatFileSize(bytes: number, locale: string): string {
  const uk = locale === "uk";
  const tag = uk ? "uk-UA" : "en-US";

  if (bytes < 1024 * 1024) {
    const kb = Math.max(1, Math.round(bytes / 1024));
    return `${new Intl.NumberFormat(tag).format(kb)} ${uk ? "КБ" : "KB"}`;
  }

  const mb = bytes / (1024 * 1024);
  return `${new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(mb)} ${uk ? "МБ" : "MB"}`;
}

/** "PDF", "PNG" — the short word under a file's name. */
export function attachmentTypeLabel(type: MessageAttachmentType): string {
  switch (type) {
    case "application/pdf":
      return "PDF";
    case "image/png":
      return "PNG";
    case "image/webp":
      return "WebP";
    case "image/jpeg":
      return "JPEG";
  }
}

/**
 * Content-Disposition for a stored file: the real name for browsers that read
 * filename*, an ASCII stand-in for the rest.
 */
export function attachmentContentDisposition(name: string, download: boolean): string {
  const ascii = name.replace(/[^\x20-\x7e]+/g, "_").replace(/["\\]/g, "_") || "file";
  // RFC 5987: ' ( ) * are not allowed bare either.
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${download ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
