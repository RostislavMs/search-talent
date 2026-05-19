"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-styles";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { useLocalizedRouter } from "@/lib/i18n/client";

type DeleteProjectButtonProps = {
  projectId: string;
  label: string;
  pendingLabel: string;
  confirmMessage: string;
  confirmTitle?: string;
  confirmButtonLabel?: string;
  cancelLabel?: string;
  errorFallback: string;
  redirectHref?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  adminEndpoint?: boolean;
};

export default function DeleteProjectButton({
  projectId,
  label,
  pendingLabel,
  confirmMessage,
  confirmTitle,
  confirmButtonLabel,
  cancelLabel,
  errorFallback,
  redirectHref,
  size = "sm",
  variant = "ghost",
  adminEndpoint = false,
}: DeleteProjectButtonProps) {
  const router = useLocalizedRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    const endpoint = adminEndpoint
      ? `/api/admin/projects/${projectId}`
      : `/api/projects/${projectId}`;
    const result = await apiFetch(endpoint, { method: "DELETE" });

    setIsDeleting(false);

    if (!result.ok) {
      setErrorMessage(result.error || errorFallback);
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
        {isDeleting ? pendingLabel : label}
      </Button>

      <ConfirmDialog
        open={dialogOpen}
        title={confirmTitle || label}
        description={confirmMessage}
        confirmLabel={confirmButtonLabel || label}
        cancelLabel={cancelLabel || "Cancel"}
        confirmVariant="primary"
        pending={isDeleting}
        pendingLabel={pendingLabel}
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
