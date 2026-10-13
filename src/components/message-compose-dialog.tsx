"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MessageComposeForm from "@/components/message-compose-form";
import { Button } from "@/components/ui/Button";
import { buttonStyles, type ButtonVariant } from "@/components/ui/button-styles";
import LocalizedLink from "@/components/ui/localized-link";
import { useDictionary } from "@/lib/i18n/client";
import { messagesCopy } from "@/lib/i18n/copy/messages";
import { buildConversationPath } from "@/lib/messages";

/**
 * "Write" on an application card: the team writes to a candidate as the
 * company. When they already talk, the button opens that conversation
 * instead of the form.
 */
export default function MessageComposeDialog({
  recipientUserId,
  recipientName,
  companyId,
  applicationId = null,
  vacancyTitle = null,
  conversationId = null,
  label,
  variant = "secondary",
}: {
  recipientUserId: string;
  recipientName: string;
  companyId: string | null;
  applicationId?: string | null;
  vacancyTitle?: string | null;
  conversationId?: string | null;
  label?: string;
  variant?: ButtonVariant;
}) {
  const copy = useDictionary({ messages: messagesCopy }).messages;
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  if (conversationId) {
    return (
      <LocalizedLink href={buildConversationPath(conversationId)} className={buttonStyles({ variant, size: "sm" })}>
        {copy.application.open}
      </LocalizedLink>
    );
  }

  const dialog = open ? (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(2,6,23,0.55)] px-3 py-6 sm:items-center sm:px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-panel border app-border bg-[color:var(--surface)] text-left text-[color:var(--foreground)] shadow-[0_28px_90px_rgba(2,6,23,0.4)]"
      >
        <div className="flex items-start justify-between gap-4 border-b app-border p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight">
              {copy.compose.title.replace("{name}", recipientName)}
            </h2>
            {vacancyTitle ? (
              <p className="mt-1 text-sm app-muted">{copy.compose.aboutApplication.replace("{vacancy}", vacancyTitle)}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={copy.compose.close}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border app-border transition hover:bg-[color:var(--surface-muted)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <MessageComposeForm
            recipientUserId={recipientUserId}
            companyId={companyId}
            applicationId={applicationId}
            requestHint={!applicationId}
            autoFocus
            onCancel={close}
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        ref={triggerRef}
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {label ?? copy.application.write}
      </Button>
      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
