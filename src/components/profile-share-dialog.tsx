"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ProfileSharePanel from "@/components/profile-share-panel";
import { Button } from "@/components/ui/Button";
import { useDictionary } from "@/lib/i18n/client";
import type { OpenToOption } from "@/lib/open-to";

/**
 * "Поділитися" on the owner's own profile: the full share panel (link, ready
 * post, QR, README badge) in a dialog. Visitors keep the small share popover —
 * they are passing on someone else's page, not handing out their own.
 */
export default function ProfileShareDialog({
  profileUrl,
  username,
  openTo,
}: {
  profileUrl: string;
  username: string;
  openTo: OpenToOption[];
}) {
  const dictionary = useDictionary();
  const t = dictionary.profileShare;
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
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-panel border app-border bg-[color:var(--surface)] text-left text-[color:var(--foreground)] shadow-[0_28px_90px_rgba(2,6,23,0.4)]"
      >
        <div className="flex items-center justify-between gap-4 border-b app-border p-5">
          <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight">
            {t.dialogTitle}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={t.close}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border app-border transition hover:bg-[color:var(--surface-muted)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <ProfileSharePanel profileUrl={profileUrl} username={username} openTo={openTo} showBadge />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="gap-1.5"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M12 3v12" />
          <path d="M8 7l4-4 4 4" />
          <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
        </svg>
        {t.button}
      </Button>
      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
