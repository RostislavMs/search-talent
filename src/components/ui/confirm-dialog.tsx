"use client";

import { useEffect } from "react";
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
      aria-labelledby="confirm-dialog-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-md rounded-[1.75rem] border app-border bg-[color:var(--surface)] p-6 text-left shadow-[0_28px_90px_rgba(2,6,23,0.4)]">
        <h2
          id="confirm-dialog-title"
          className="text-left text-lg font-semibold text-[color:var(--foreground)]"
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
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
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
