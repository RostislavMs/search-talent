"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";

type Item = { id: string; kind: "article" | "project" };

type Labels = {
  selected: string;
  clear: string;
  bulkDelete: string;
  applying: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmButton: string;
  cancel: string;
  errorFallback: string;
};

type Props = {
  items: Item[];
  labels: Labels;
  children: (ctx: {
    isSelected: (item: Item) => boolean;
    toggle: (item: Item) => void;
    toggleAll: () => void;
    allSelected: boolean;
  }) => ReactNode;
};

function itemKey(item: Item): string {
  return `${item.kind}:${item.id}`;
}

export default function CommentsBulkTable({ items, labels, children }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelected = (item: Item) => selected.has(itemKey(item));

  function toggle(item: Item) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = itemKey(item);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAll() {
    if (items.length === 0) return;
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(itemKey)));
    }
  }

  async function applyDelete() {
    if (selected.size === 0) return;

    const payloadItems: Item[] = items.filter((item) => isSelected(item));
    setPending(true);
    setError(null);

    const result = await apiFetch("/api/admin/comments/bulk", {
      method: "POST",
      body: { items: payloadItems },
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error || labels.errorFallback);
      return;
    }

    setDialogOpen(false);
    setSelected(new Set());
    router.refresh();
  }

  const hasSelection = selected.size > 0;
  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <>
      {hasSelection ? (
        <div className="sticky top-20 z-30 mb-4 flex flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 shadow-[0_12px_32px_rgba(2,6,23,0.18)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:rounded-full sm:px-5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[color:var(--foreground)]">
              {selected.size} {labels.selected}
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="cursor-pointer text-xs app-soft underline decoration-[color:var(--border)] underline-offset-4 hover:text-[color:var(--foreground)]"
            >
              {labels.clear}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                setDialogOpen(true);
              }}
              disabled={pending}
            >
              {labels.bulkDelete}
            </Button>
          </div>
        </div>
      ) : null}

      {children({ isSelected, toggle, toggleAll, allSelected })}

      <ConfirmDialog
        open={dialogOpen}
        title={labels.confirmTitle}
        description={labels.confirmMessage}
        confirmLabel={labels.confirmButton}
        cancelLabel={labels.cancel}
        confirmVariant="primary"
        pending={pending}
        pendingLabel={labels.applying}
        errorMessage={error}
        onConfirm={applyDelete}
        onCancel={() => {
          if (pending) return;
          setDialogOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
