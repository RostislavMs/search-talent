"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { ButtonVariant } from "@/components/ui/button-styles";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: ButtonVariant;
  pending?: boolean;
  pendingLabel?: string;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmVariant = "primary",
  pending = false,
  pendingLabel,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog and lock the page behind it; on close, hand
  // focus back to whatever opened it. Keyed on `open` alone so a parent that
  // re-creates its callbacks every render does not bounce focus around.
  useEffect(() => {
    if (!open) {
      return;
    }

    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Cancel, not confirm: most of these guard something destructive, and a
    // stray Enter should land on the harmless choice.
    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, pending, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,23,0.55)] px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-md rounded-panel border app-border bg-[color:var(--surface)] p-6 text-left shadow-[0_28px_90px_rgba(2,6,23,0.4)]">
        <h2
          id={titleId}
          className="font-display text-left text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-3 text-left text-sm leading-7 app-muted">
            {description}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-3 text-left text-sm text-rose-500">{errorMessage}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelRef}
            variant="ghost"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending && pendingLabel ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
