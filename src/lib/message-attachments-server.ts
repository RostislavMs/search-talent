import "server-only";

import { NextResponse } from "next/server";
import type { StoredAttachment } from "@/lib/db/message-attachments";
import { attachmentContentDisposition } from "@/lib/message-attachments";
import { createPrivateDownloadUrl } from "@/lib/storage/r2";

/** How long a link into the private bucket lives. */
export const ATTACHMENT_LINK_SECONDS = 300;

/**
 * The answer to "open this file": a redirect to a fresh signed link. The
 * redirect itself is never cached, so each opening asks the database again.
 */
export async function redirectToStoredAttachment(stored: StoredAttachment, download: boolean): Promise<NextResponse> {
  let url: string;

  try {
    url = await createPrivateDownloadUrl({
      key: stored.storageKey,
      contentType: stored.contentType,
      contentDisposition: attachmentContentDisposition(stored.fileName, download),
      expiresIn: ATTACHMENT_LINK_SECONDS,
    });
  } catch (error) {
    console.error("[messages] signing a file link failed", error);
    return NextResponse.json({ error: "Files are not available" }, { status: 503 });
  }

  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
