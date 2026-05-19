"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { apiFetch, type ApiResult } from "@/lib/api-client";

type ActionLabels = {
  openProfile: string;
  promote: string;
  demote: string;
  delete: string;
  deleting: string;
  confirmPromoteTitle: string;
  confirmPromoteMessage: string;
  confirmDemoteTitle: string;
  confirmDemoteMessage: string;
  confirmDeleteTitle: string;
  confirmDeleteMessage: string;
  confirmButton: string;
  cancel: string;
  errorFallback: string;
  self: string;
};

type Props = {
  userId: string;
  profileId: string | null;
  isAdmin: boolean;
  isSelf: boolean;
  labels: ActionLabels;
};

type DialogKind = "promote" | "demote" | "delete" | null;

export default function UserRowActions({
  userId,
  profileId,
  isAdmin,
  isSelf,
  labels,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isSelf) {
    return <span className="text-xs app-soft">{labels.self}</span>;
  }

  async function confirmAction() {
    if (!dialog) return;

    setPending(true);
    setError(null);

    let result: ApiResult<unknown>;
    if (dialog === "promote") {
      result = await apiFetch(`/api/admin/users/${userId}/admin-role`, {
        method: "POST",
      });
    } else if (dialog === "demote") {
      result = await apiFetch(`/api/admin/users/${userId}/admin-role`, {
        method: "DELETE",
      });
    } else {
      if (!profileId) {
        setPending(false);
        setError(labels.errorFallback);
        return;
      }
      result = await apiFetch(`/api/admin/profiles/${profileId}`, {
        method: "DELETE",
      });
    }

    setPending(false);

    if (!result.ok) {
      setError(result.error || labels.errorFallback);
      return;
    }

    setDialog(null);
    router.refresh();
  }

  const dialogConfig =
    dialog === "promote"
      ? {
          title: labels.confirmPromoteTitle,
          description: labels.confirmPromoteMessage,
          variant: "primary" as const,
        }
      : dialog === "demote"
        ? {
            title: labels.confirmDemoteTitle,
            description: labels.confirmDemoteMessage,
            variant: "secondary" as const,
          }
        : dialog === "delete"
          ? {
              title: labels.confirmDeleteTitle,
              description: labels.confirmDeleteMessage,
              variant: "primary" as const,
            }
          : null;

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        {isAdmin ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setError(null);
              setDialog("demote");
            }}
          >
            {labels.demote}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setError(null);
              setDialog("promote");
            }}
          >
            {labels.promote}
          </Button>
        )}
        {profileId ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setError(null);
              setDialog("delete");
            }}
          >
            {labels.delete}
          </Button>
        ) : null}
      </div>

      {dialogConfig ? (
        <ConfirmDialog
          open={dialog !== null}
          title={dialogConfig.title}
          description={dialogConfig.description}
          confirmLabel={labels.confirmButton}
          cancelLabel={labels.cancel}
          confirmVariant={dialogConfig.variant}
          pending={pending}
          pendingLabel={labels.deleting}
          errorMessage={error}
          onConfirm={confirmAction}
          onCancel={() => {
            if (pending) return;
            setDialog(null);
            setError(null);
          }}
        />
      ) : null}
    </>
  );
}
