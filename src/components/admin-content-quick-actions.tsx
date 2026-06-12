"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button-styles";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";
import { useLocalizedRouter } from "@/lib/i18n/client";
import {
  normalizeModerationStatus,
  type ModerationStatus,
} from "@/lib/moderation";

type TargetType = "profile" | "project" | "article";

type AdminContentQuickActionsProps = {
  targetType: TargetType;
  targetId: string;
  currentStatus: string | null;
  locale: string;
  redirectAfterDelete: string;
  size?: ButtonSize;
  hideVariant?: ButtonVariant;
  deleteVariant?: ButtonVariant;
};

function getCopy(locale: string, targetType: TargetType) {
  const isUk = locale === "uk";
  const label = isUk
    ? targetType === "profile"
      ? "профіль"
      : targetType === "project"
        ? "проєкт"
        : "статтю"
    : targetType === "profile"
      ? "profile"
      : targetType === "project"
        ? "project"
        : "article";

  const labelGenitive = isUk
    ? targetType === "profile"
      ? "профілю"
      : targetType === "project"
        ? "проєкту"
        : "статті"
    : label;

  return isUk
    ? {
        hide: `Сховати ${label}`,
        show: `Показати ${label}`,
        hiding: "Збереження...",
        showing: "Збереження...",
        delete: `Видалити ${label}`,
        deleting: "Видалення...",
        confirmHideTitle: `Сховати ${label}?`,
        confirmHideMessage: `${label[0].toUpperCase()}${label.slice(1)} більше не буде видимою публічно, але дані збережуться. Ви зможете повернути видимість пізніше.`,
        confirmHideButton: "Сховати",
        confirmShowTitle: `Повернути ${labelGenitive} видимість?`,
        confirmShowMessage: `${label[0].toUpperCase()}${label.slice(1)} знову стане публічно видимою.`,
        confirmShowButton: "Показати",
        confirmDeleteTitle: `Видалити ${label} назавжди?`,
        confirmDeleteMessage:
          "Дію не можна скасувати. Всі дані будуть прибрані остаточно.",
        confirmDeleteButton: "Видалити",
        cancel: "Скасувати",
        hideError: "Не вдалося змінити видимість.",
        deleteError: "Не вдалося видалити запис.",
      }
    : {
        hide: `Hide ${label}`,
        show: `Show ${label}`,
        hiding: "Saving...",
        showing: "Saving...",
        delete: `Delete ${label}`,
        deleting: "Deleting...",
        confirmHideTitle: `Hide this ${label}?`,
        confirmHideMessage: `The ${label} will no longer be publicly visible, but data is preserved. You can restore visibility later.`,
        confirmHideButton: "Hide",
        confirmShowTitle: `Restore ${label} visibility?`,
        confirmShowMessage: `The ${label} will become publicly visible again.`,
        confirmShowButton: "Show",
        confirmDeleteTitle: `Permanently delete this ${label}?`,
        confirmDeleteMessage:
          "This action cannot be undone. All data will be removed permanently.",
        confirmDeleteButton: "Delete",
        cancel: "Cancel",
        hideError: "Could not update visibility.",
        deleteError: "Could not delete the record.",
      };
}

function getDeleteEndpoint(targetType: TargetType, targetId: string) {
  switch (targetType) {
    case "profile":
      return `/api/admin/profiles/${targetId}`;
    case "project":
      return `/api/admin/projects/${targetId}`;
    case "article":
      return `/api/admin/articles/${targetId}`;
  }
}

export default function AdminContentQuickActions({
  targetType,
  targetId,
  currentStatus,
  locale,
  redirectAfterDelete,
  size = "sm",
  hideVariant = "secondary",
  deleteVariant = "ghost",
}: AdminContentQuickActionsProps) {
  const router = useLocalizedRouter();
  const copy = getCopy(locale, targetType);

  const normalized: ModerationStatus =
    normalizeModerationStatus(currentStatus) || "approved";
  // Anything that is not "approved" is not publicly visible — including
  // "under_review" — so the primary action becomes "Show" (→ approved). This
  // gives an approve path for content awaiting / auto-flagged for review.
  const isHidden = normalized !== "approved";

  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleToggleVisibility = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    const nextStatus: ModerationStatus = isHidden ? "approved" : "removed";
    const result = await apiFetch("/api/admin/moderation", {
      method: "POST",
      body: { targetType, targetId, moderationStatus: nextStatus },
    });

    setIsSaving(false);

    if (!result.ok) {
      setErrorMessage(result.error || copy.hideError);
      return;
    }

    setVisibilityDialogOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    const result = await apiFetch(getDeleteEndpoint(targetType, targetId), {
      method: "DELETE",
    });

    setIsDeleting(false);

    if (!result.ok) {
      setErrorMessage(result.error || copy.deleteError);
      return;
    }

    setDeleteDialogOpen(false);
    router.replace(redirectAfterDelete);
  };

  return (
    <>
      <Button
        size={size}
        variant={hideVariant}
        onClick={() => {
          setErrorMessage(null);
          setVisibilityDialogOpen(true);
        }}
        disabled={isSaving || isDeleting}
      >
        {isSaving
          ? isHidden
            ? copy.showing
            : copy.hiding
          : isHidden
            ? copy.show
            : copy.hide}
      </Button>

      <Button
        size={size}
        variant={deleteVariant}
        onClick={() => {
          setErrorMessage(null);
          setDeleteDialogOpen(true);
        }}
        disabled={isSaving || isDeleting}
      >
        {isDeleting ? copy.deleting : copy.delete}
      </Button>

      <ConfirmDialog
        open={visibilityDialogOpen}
        title={isHidden ? copy.confirmShowTitle : copy.confirmHideTitle}
        description={isHidden ? copy.confirmShowMessage : copy.confirmHideMessage}
        confirmLabel={isHidden ? copy.confirmShowButton : copy.confirmHideButton}
        cancelLabel={copy.cancel}
        confirmVariant="primary"
        pending={isSaving}
        pendingLabel={isHidden ? copy.showing : copy.hiding}
        errorMessage={visibilityDialogOpen ? errorMessage : null}
        onCancel={() => {
          if (!isSaving) {
            setVisibilityDialogOpen(false);
            setErrorMessage(null);
          }
        }}
        onConfirm={() => void handleToggleVisibility()}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title={copy.confirmDeleteTitle}
        description={copy.confirmDeleteMessage}
        confirmLabel={copy.confirmDeleteButton}
        cancelLabel={copy.cancel}
        confirmVariant="primary"
        pending={isDeleting}
        pendingLabel={copy.deleting}
        errorMessage={deleteDialogOpen ? errorMessage : null}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteDialogOpen(false);
            setErrorMessage(null);
          }
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
