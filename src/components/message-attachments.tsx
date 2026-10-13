"use client";

import { useState } from "react";
import { useDictionary } from "@/lib/i18n/client";
import {
  attachmentTypeLabel,
  buildAttachmentHref,
  formatFileSize,
  isImageAttachment,
  type MessageAttachment,
} from "@/lib/message-attachments";
import type { AttachmentDraft } from "@/lib/use-message-attachments";

function DocumentIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m20.5 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A file that is not an image (a PDF): its name, type and size; opens in a new tab. */
function FileCard({ attachment, locale }: { attachment: MessageAttachment; locale: string }) {
  const copy = useDictionary().messages.files;

  return (
    <a
      href={buildAttachmentHref(attachment.id)}
      target="_blank"
      rel="noopener"
      aria-label={copy.open.replace("{name}", attachment.name)}
      className="flex w-72 max-w-full items-center gap-3 rounded-2xl border app-border bg-[color:var(--surface)] px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--surface-muted)]"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--surface-muted)] text-[color:var(--foreground)]">
        <DocumentIcon />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-[color:var(--foreground)]">{attachment.name}</span>
        <span className="block text-xs app-soft">
          {attachmentTypeLabel(attachment.type)} · {formatFileSize(attachment.size, locale)}
        </span>
      </span>
    </a>
  );
}

/** An image: the picture itself (its place kept while it loads); opens full size in a new tab. */
function ImageTile({ attachment, single }: { attachment: MessageAttachment; single: boolean }) {
  const copy = useDictionary().messages.files;
  const [broken, setBroken] = useState(false);
  const href = buildAttachmentHref(attachment.id);

  if (broken) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="flex min-h-20 items-center justify-center rounded-2xl border app-border bg-[color:var(--surface-muted)] px-3 py-4 text-center text-xs app-soft transition-colors hover:text-[color:var(--foreground)]"
      >
        {copy.unavailable}
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={copy.open.replace("{name}", attachment.name)}
      className="block overflow-hidden rounded-2xl border app-border bg-[color:var(--surface-muted)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a private file behind a signed redirect, not for the image optimizer */}
      <img
        src={href}
        alt={attachment.name}
        width={attachment.width ?? undefined}
        height={attachment.height ?? undefined}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={
          single
            ? "block h-auto max-h-80 w-auto max-w-[min(18rem,100%)]"
            : "block aspect-square h-full w-full object-cover"
        }
      />
    </a>
  );
}

/**
 * The files of a message, under its text (or alone, for a message of files):
 * images as pictures, the rest as cards. Each opens through our route, which
 * checks the reader again and hands out a link that lives minutes.
 */
export default function MessageAttachments({
  attachments,
  locale,
  alignEnd,
}: {
  attachments: MessageAttachment[];
  locale: string;
  alignEnd: boolean;
}) {
  if (attachments.length === 0) return null;

  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((attachment) => !isImageAttachment(attachment));

  return (
    <div className={`flex w-full flex-col gap-1.5 ${alignEnd ? "items-end" : "items-start"}`}>
      {images.length === 1 ? (
        <ImageTile attachment={images[0]} single />
      ) : images.length > 1 ? (
        <div className="grid w-72 max-w-full grid-cols-2 gap-1.5">
          {images.map((attachment) => (
            <ImageTile key={attachment.id} attachment={attachment} single={false} />
          ))}
        </div>
      ) : null}
      {files.map((attachment) => (
        <FileCard key={attachment.id} attachment={attachment} locale={locale} />
      ))}
    </div>
  );
}

/**
 * The files of the message being written, above the box: a picture or an
 * icon, the name, how the upload goes, and a way to take each one out (or
 * try it again).
 */
export function AttachmentDrafts({
  drafts,
  onRemove,
  onRetry,
}: {
  drafts: AttachmentDraft[];
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
}) {
  const copy = useDictionary().messages;

  if (drafts.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2" aria-label={copy.files.attach}>
      {drafts.map((draft) => {
        const status =
          draft.status === "preparing"
            ? copy.files.preparing
            : draft.status === "uploading"
              ? copy.files.uploading.replace("{progress}", String(draft.progress))
              : draft.status === "failed"
                ? draft.error && draft.error !== "failed"
                  ? copy.errors[draft.error]
                  : copy.files.failed
                : null;

        return (
          <li
            key={draft.key}
            className={`flex max-w-full items-center gap-2 rounded-2xl border py-1.5 pr-1.5 pl-1.5 ${
              draft.status === "failed" ? "border-rose-500/50" : "app-border"
            } bg-[color:var(--surface)]`}
          >
            {draft.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local preview (blob:) of a file being uploaded
              <img src={draft.previewUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--surface-muted)] text-[color:var(--foreground)]">
                <DocumentIcon className="h-4 w-4" />
              </span>
            )}
            <span className="min-w-0 max-w-48">
              <span className="block truncate text-xs font-medium text-[color:var(--foreground)]">{draft.name}</span>
              {status ? (
                <span
                  className={`block truncate text-[11px] ${draft.status === "failed" ? "text-rose-600 dark:text-rose-400" : "app-soft"}`}
                  role={draft.status === "failed" ? "alert" : undefined}
                >
                  {status}
                </span>
              ) : null}
            </span>
            {draft.status === "failed" ? (
              <button
                type="button"
                onClick={() => onRetry(draft.key)}
                className="cursor-pointer rounded-full px-2 py-1 text-[11px] font-medium text-[color:var(--foreground)] underline underline-offset-2"
              >
                {copy.files.retry}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onRemove(draft.key)}
              aria-label={copy.files.remove.replace("{name}", draft.name)}
              className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full app-soft transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
