"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";

type BulkAction = "approve" | "hide" | "restrict" | "delete";

type Labels = {
  selected: string;
  clear: string;
  bulkApprove: string;
  bulkHide: string;
  bulkRestrict: string;
  bulkDelete: string;
  applying: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmButton: string;
  cancel: string;
  errorFallback: string;
};

type Props = {
  targetType: "article" | "project";
  ids: string[];
  canDelete?: boolean;
  labels: Labels;
  children: (ctx: {
    selected: Set<string>;
    toggle: (id: string) => void;
    toggleAll: () => void;
    allSelected: boolean;
  }) => ReactNode;
};

const actionToStatus: Record<Exclude<BulkAction, "delete">, string> = {
  approve: "approved",
  hide: "removed",
  restrict: "restricted",
};

export default function ContentBulkTable({
  targetType,
  ids,
  canDelete = true,
  labels,
  children,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [dialog, setDialog] = useState<BulkAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === ids.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ids));
    }
  }

  async function applyAction() {
    if (!dialog || selected.size === 0) return;
    setPendingAction(dialog);
    setError(null);

    const body: Record<string, unknown> = {
      targetType,
      ids: Array.from(selected),
    };

    if (dialog === "delete") {
      body.action = "delete";
    } else {
      body.action = "status_update";
      body.moderationStatus = actionToStatus[dialog];
    }

    const result = await apiFetch("/api/admin/bulk", {
      method: "POST",
      body,
    });

    setPendingAction(null);

    if (!result.ok) {
      setError(result.error || labels.errorFallback);
      return;
    }

    setDialog(null);
    setSelected(new Set());
    router.refresh();
  }

  const hasSelection = selected.size > 0;
  const allSelected = ids.length > 0 && selected.size === ids.length;

  return (
    <>
      {hasSelection ? (
        <div className="sticky top-20 z-30 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-3 shadow-[0_12px_32px_rgba(2,6,23,0.18)]">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[color:var(--foreground)]">
              {selected.size} {labels.selected}
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs app-soft underline decoration-[color:var(--border)] underline-offset-4"
            >
              {labels.clear}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                setDialog("approve");
              }}
              disabled={pendingAction !== null}
            >
              {labels.bulkApprove}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                setDialog("hide");
              }}
              disabled={pendingAction !== null}
            >
              {labels.bulkHide}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                setDialog("restrict");
              }}
              disabled={pendingAction !== null}
            >
              {labels.bulkRestrict}
            </Button>
            {canDelete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  setDialog("delete");
                }}
                disabled={pendingAction !== null}
              >
                {labels.bulkDelete}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {children({ selected, toggle, toggleAll, allSelected })}

      {dialog ? (
        <ConfirmDialog
          open={dialog !== null}
          title={labels.confirmTitle}
          description={labels.confirmMessage}
          confirmLabel={labels.confirmButton}
          cancelLabel={labels.cancel}
          confirmVariant={dialog === "delete" ? "primary" : "secondary"}
          pending={pendingAction !== null}
          pendingLabel={labels.applying}
          errorMessage={error}
          onConfirm={applyAction}
          onCancel={() => {
            if (pendingAction !== null) return;
            setDialog(null);
            setError(null);
          }}
        />
      ) : null}
    </>
  );
}
