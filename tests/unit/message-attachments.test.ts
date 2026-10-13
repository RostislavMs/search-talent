import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  attachmentContentDisposition,
  attachmentTypeLabel,
  buildAdminAttachmentHref,
  buildAttachmentHref,
  checkAttachmentFile,
  formatFileSize,
  isImageAttachment,
  MESSAGE_ATTACHMENT_ACCEPT,
  MESSAGE_ATTACHMENT_MAX_BYTES,
  normalizeMessageAttachments,
  sniffAttachmentType,
} from "@/lib/message-attachments";
import {
  canAttachFiles,
  messageRefusalCodes,
  normalizeConversationRow,
  normalizeMessageRow,
  type LastMessagePreview,
} from "@/lib/messages";
import { describeLastMessage } from "@/lib/messages-presentation";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe("telling a file's type from its first bytes", () => {
  it("knows JPEG, PNG, WebP and PDF", () => {
    expect(sniffAttachmentType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe("image/jpeg");
    expect(sniffAttachmentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffAttachmentType(ascii("RIFF\u0010\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
    expect(sniffAttachmentType(ascii("%PDF-1.7\n%"))).toBe("application/pdf");
  });

  it("refuses everything else, whatever it is called", () => {
    expect(sniffAttachmentType(ascii("<!doctype html><script>"))).toBeNull();
    expect(sniffAttachmentType(ascii("GIF89a"))).toBeNull();
    expect(sniffAttachmentType(ascii("<svg xmlns="))).toBeNull();
    expect(sniffAttachmentType(ascii("RIFF\u0010\u0000\u0000\u0000WAVEfmt "))).toBeNull();
    expect(sniffAttachmentType(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull();
    expect(sniffAttachmentType(ascii(" %PDF-1.7"))).toBeNull();
    expect(sniffAttachmentType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffAttachmentType(new Uint8Array())).toBeNull();
  });
});

describe("checking a picked file", () => {
  it("takes the four types up to 10 MB", () => {
    expect(checkAttachmentFile({ type: "application/pdf", size: 1 })).toBeNull();
    expect(checkAttachmentFile({ type: "image/webp", size: MESSAGE_ATTACHMENT_MAX_BYTES })).toBeNull();
    expect(checkAttachmentFile({ type: "image/png", size: MESSAGE_ATTACHMENT_MAX_BYTES + 1 })).toBe("file_too_large");
    expect(checkAttachmentFile({ type: "image/png", size: 0 })).toBe("file_empty");
    expect(checkAttachmentFile({ type: "image/gif", size: 10 })).toBe("file_type");
    expect(checkAttachmentFile({ type: "", size: 10 })).toBe("file_type");
  });

  it("offers the same types in the picker", () => {
    expect(MESSAGE_ATTACHMENT_ACCEPT).toBe("image/jpeg,image/png,image/webp,application/pdf");
  });
});

describe("reading files from the database", () => {
  it("keeps the accepted files and their fields", () => {
    expect(
      normalizeMessageAttachments([
        { id: "f1", name: "cv.pdf", type: "application/pdf", size: 1200, width: null, height: null },
        { id: "f2", name: "", type: "image/webp", size: "300", width: 800, height: 600 },
        { id: "f3", name: "x.svg", type: "image/svg+xml", size: 1 },
        { name: "no id", type: "image/png" },
        null,
      ]),
    ).toEqual([
      { id: "f1", name: "cv.pdf", type: "application/pdf", size: 1200, width: null, height: null },
      { id: "f2", name: "file", type: "image/webp", size: 300, width: 800, height: 600 },
    ]);
    expect(normalizeMessageAttachments(null)).toEqual([]);
    expect(normalizeMessageAttachments("x")).toEqual([]);
  });

  it("a message carries its files, a list row how many", () => {
    const row = normalizeMessageRow({
      id: "m1",
      seq: 3,
      kind: "text",
      body: "",
      attachments: [{ id: "f1", name: "a.png", type: "image/png", size: 10, width: 1, height: 1 }],
    });
    expect(row?.attachments.map((file) => file.id)).toEqual(["f1"]);
    expect(normalizeMessageRow({ id: "m2", seq: 4, kind: "text", body: "hi" })?.attachments).toEqual([]);

    const conversation = normalizeConversationRow({
      id: "c1",
      kind: "direct",
      last_message: { id: "m1", seq: 3, kind: "text", body: "", attachmentCount: 2, createdAt: "t" },
    });
    expect(conversation?.lastMessage?.attachmentCount).toBe(2);
    expect(normalizeConversationRow({ id: "c2", last_message: { id: "m", seq: 1 } })?.lastMessage?.attachmentCount).toBe(0);
  });
});

describe("where a file opens", () => {
  it("through our routes, never the bucket", () => {
    expect(buildAttachmentHref("f1")).toBe("/api/messages/attachments/f1");
    expect(buildAttachmentHref("f1", true)).toBe("/api/messages/attachments/f1?download=1");
    expect(buildAdminAttachmentHref("f1", "r 1")).toBe("/api/admin/message-attachments/f1?report=r%201");
  });

  it("names the file for the browser", () => {
    expect(attachmentContentDisposition("cv.pdf", false)).toBe(`inline; filename="cv.pdf"; filename*=UTF-8''cv.pdf`);
    expect(attachmentContentDisposition("Резюме (1).pdf", true)).toBe(
      `attachment; filename="_ (1).pdf"; filename*=UTF-8''%D0%A0%D0%B5%D0%B7%D1%8E%D0%BC%D0%B5%20%281%29.pdf`,
    );
    expect(attachmentContentDisposition('a"b\\c.png', false)).toContain(`filename="a_b_c.png"`);
  });
});

describe("words around a file", () => {
  it("sizes and types", () => {
    expect(formatFileSize(500, "en")).toBe("1 KB");
    expect(formatFileSize(840 * 1024, "en")).toBe("840 KB");
    expect(formatFileSize(2.45 * 1024 * 1024, "en")).toBe("2.5 MB");
    expect(formatFileSize(2.45 * 1024 * 1024, "uk")).toBe("2,5 МБ");
    expect(attachmentTypeLabel("application/pdf")).toBe("PDF");
    expect(attachmentTypeLabel("image/webp")).toBe("WebP");
    expect(isImageAttachment({ type: "image/png" })).toBe(true);
    expect(isImageAttachment({ type: "application/pdf" })).toBe(false);
  });

  it("every refusal has words in both languages", () => {
    for (const locale of ["uk", "en"] as const) {
      const errors = getDictionary(locale).messages.errors as Record<string, string>;
      for (const code of messageRefusalCodes) {
        expect(errors[code], `${locale}: ${code}`).toBeTruthy();
      }
    }
  });

  it("a message of files alone in the list", () => {
    const base: LastMessagePreview = {
      id: "m1",
      seq: 1,
      kind: "text",
      event: null,
      eventData: null,
      body: "",
      held: false,
      removed: false,
      removedBy: null,
      attachmentCount: 1,
      fromMySide: false,
      mine: false,
      createdAt: "2026-10-12T10:00:00Z",
    };
    const uk = getDictionary("uk").messages;
    const en = getDictionary("en").messages;
    expect(describeLastMessage(base, uk)).toBe("Файл");
    expect(describeLastMessage({ ...base, attachmentCount: 3 }, uk)).toBe("Файли: 3");
    expect(describeLastMessage({ ...base, attachmentCount: 2, mine: true, fromMySide: true }, en)).toBe("You: Files: 2");
    expect(describeLastMessage({ ...base, body: "My CV" }, en)).toBe("My CV");
    expect(describeLastMessage({ ...base, removed: true, removedBy: "author", attachmentCount: 0 }, en)).toBe(en.preview.deleted);
  });
});

describe("the paperclip", () => {
  it("only where one may write and the conversation is open", () => {
    expect(canAttachFiles({ canSend: true, state: "open", requestRules: false })).toBe(true);
    expect(canAttachFiles({ canSend: true, state: "request", requestRules: false })).toBe(false);
    expect(canAttachFiles({ canSend: true, state: "open", requestRules: true })).toBe(false);
    expect(canAttachFiles({ canSend: false, state: "open", requestRules: false })).toBe(false);
  });
});
