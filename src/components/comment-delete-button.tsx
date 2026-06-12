"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";

type CommentDeleteButtonProps = {
  /** DELETE endpoint, e.g. /api/projects/<id>/comments/<commentId>. */
  endpoint: string;
  locale: string;
  /** Called after a successful delete so the parent can refresh the thread. */
  onDeleted: () => void;
};

/**
 * Small inline "Delete" control for a comment, shown to the comment author and
 * to the owner of the parent content. Confirms before deleting; the server
 * enforces the actual authorization.
 */
export default function CommentDeleteButton({
  endpoint,
  locale,
  onDeleted,
}: CommentDeleteButtonProps) {
  const isUk = locale === "uk";
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setPending(true);
    setError(null);

    const result = await apiFetch(endpoint, { method: "DELETE" });

    setPending(false);

    if (!result.ok) {
      setError(result.error || (isUk ? "Не вдалося видалити" : "Could not delete"));
      return;
    }

    setOpen(false);
    onDeleted();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="cursor-pointer text-xs font-medium app-soft transition-colors hover:text-rose-500"
      >
        {isUk ? "Видалити" : "Delete"}
      </button>

      <ConfirmDialog
        open={open}
        title={isUk ? "Видалити коментар?" : "Delete comment?"}
        description={
          isUk
            ? "Коментар і всі відповіді на нього буде видалено остаточно."
            : "The comment and all of its replies will be permanently deleted."
        }
        confirmLabel={isUk ? "Видалити" : "Delete"}
        cancelLabel={isUk ? "Скасувати" : "Cancel"}
        confirmVariant="primary"
        pending={pending}
        pendingLabel={isUk ? "Видалення..." : "Deleting..."}
        errorMessage={open ? error : null}
        onCancel={() => {
          if (!pending) {
            setOpen(false);
            setError(null);
          }
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
