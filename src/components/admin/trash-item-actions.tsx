"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";

export type TrashActionLabels = {
  restore: string;
  restoring: string;
  erase: string;
  erasing: string;
  restoreTitle: string;
  restoreMessage: string;
  restoreAccountMessage: string;
  eraseTitle: string;
  eraseMessage: string;
  eraseAccountMessage: string;
  cancel: string;
  errors: Record<"conflict" | "missing_parent" | "not_found" | "forbidden" | "failed", string>;
};

type Props = {
  groupId: string;
  isAccount: boolean;
  labels: TrashActionLabels;
};

type Action = "restore" | "erase";

export default function TrashItemActions({ groupId, isAccount, labels }: Props) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(next: Action) {
    setError(null);
    setAction(next);
  }

  async function confirm() {
    if (!action) return;
    setPending(true);
    setError(null);

    const result = await apiFetch(`/api/admin/trash/${groupId}`, {
      method: action === "restore" ? "POST" : "DELETE",
    });

    setPending(false);

    if (!result.ok) {
      const code = result.code as keyof TrashActionLabels["errors"] | undefined;
      setError((code && labels.errors[code]) || labels.errors.failed);
      return;
    }

    setAction(null);
    router.refresh();
  }

  const isRestore = action === "restore";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => open("restore")}>
          {labels.restore}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => open("erase")}>
          {labels.erase}
        </Button>
      </div>
      {action ? (
        <ConfirmDialog
          open
          title={isRestore ? labels.restoreTitle : labels.eraseTitle}
          description={
            isRestore
              ? isAccount
                ? labels.restoreAccountMessage
                : labels.restoreMessage
              : isAccount
                ? labels.eraseAccountMessage
                : labels.eraseMessage
          }
          confirmLabel={isRestore ? labels.restore : labels.erase}
          cancelLabel={labels.cancel}
          confirmVariant="primary"
          pending={pending}
          pendingLabel={isRestore ? labels.restoring : labels.erasing}
          errorMessage={error}
          onConfirm={confirm}
          onCancel={() => {
            if (pending) return;
            setAction(null);
            setError(null);
          }}
        />
      ) : null}
    </>
  );
}
