"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-styles";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { useLocalizedRouter } from "@/lib/i18n/client";

export default function DeletePollButton({
  pollId,
  locale,
  redirectHref,
  adminEndpoint = false,
  size = "sm",
  variant = "ghost",
}: {
  pollId: string;
  locale: string;
  redirectHref?: string;
  adminEndpoint?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  const router = useLocalizedRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isUk = locale === "uk";

  const ui = isUk
    ? {
        label: adminEndpoint ? "Видалити як адмін" : "Видалити",
        pending: "Видалення...",
        title: "Видалити опитування?",
        message: "Дію не можна скасувати. Опитування та всі голоси буде прибрано назавжди.",
        confirm: "Видалити",
        cancel: "Скасувати",
        error: "Не вдалося видалити опитування.",
      }
    : {
        label: adminEndpoint ? "Delete as admin" : "Delete",
        pending: "Deleting...",
        title: "Delete this poll?",
        message: "This action cannot be undone. The poll and all its votes will be removed permanently.",
        confirm: "Delete",
        cancel: "Cancel",
        error: "Could not delete the poll.",
      };

  const handleConfirm = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    const endpoint = adminEndpoint ? `/api/admin/polls/${pollId}` : `/api/polls/${pollId}`;
    const result = await apiFetch(endpoint, { method: "DELETE" });
    setIsDeleting(false);
    if (!result.ok) {
      setErrorMessage(result.error || ui.error);
      return;
    }
    setDialogOpen(false);
    if (redirectHref) {
      router.replace(redirectHref);
      return;
    }
    router.refresh();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => {
          setErrorMessage(null);
          setDialogOpen(true);
        }}
        disabled={isDeleting}
      >
        {isDeleting ? ui.pending : ui.label}
      </Button>

      <ConfirmDialog
        open={dialogOpen}
        title={ui.title}
        description={ui.message}
        confirmLabel={ui.confirm}
        cancelLabel={ui.cancel}
        confirmVariant="primary"
        pending={isDeleting}
        pendingLabel={ui.pending}
        errorMessage={errorMessage}
        onCancel={() => {
          if (!isDeleting) {
            setDialogOpen(false);
            setErrorMessage(null);
          }
        }}
        onConfirm={() => void handleConfirm()}
      />
    </>
  );
}
