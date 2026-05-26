"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { apiFetch } from "@/lib/api-client";

type AdminFeedbackEntryProps = {
  id: string;
  categoryLabel: string;
  category: string;
  message: string;
  createdAtLabel: string;
  name: string | null;
  email: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
  profileHref: string | null;
  copy: {
    anonymous: string;
    from: string;
    email: string;
    category: string;
    submittedAt: string;
    openProfile: string;
    dismiss: string;
    dismissing: string;
    confirmTitle: string;
    confirmMessage: string;
    confirmButton: string;
    cancel: string;
    errorFallback: string;
  };
};

export default function AdminFeedbackEntry({
  id,
  categoryLabel,
  category,
  message,
  createdAtLabel,
  name,
  email,
  authorUsername,
  authorDisplayName,
  profileHref,
  copy,
}: AdminFeedbackEntryProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    const result = await apiFetch(`/api/admin/feedback/${id}`, {
      method: "DELETE",
    });

    setIsDeleting(false);

    if (!result.ok) {
      setErrorMessage(result.error || copy.errorFallback);
      return;
    }

    setDialogOpen(false);
    router.refresh();
  };

  const displayAuthor =
    authorDisplayName ||
    name ||
    (authorUsername ? `@${authorUsername}` : null) ||
    copy.anonymous;

  return (
    <article className="rounded-hero app-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">
            <span className="rounded-full border border-[color:var(--border)] px-3 py-1">
              {categoryLabel}
            </span>
            <span>{category}</span>
          </div>

          <p className="mt-4 whitespace-pre-line text-base leading-7 text-[color:var(--foreground)]">
            {message}
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-sm app-muted">
            <span>
              {copy.from}: {displayAuthor}
            </span>
            {email ? (
              <span>
                {copy.email}: {email}
              </span>
            ) : null}
            <span>
              {copy.submittedAt}: {createdAtLabel}
            </span>
          </div>

          {profileHref ? (
            <div className="mt-4">
              <Link
                href={profileHref}
                className="text-sm font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
              >
                {copy.openProfile}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex w-full flex-col gap-2 lg:w-auto">
          <Button
            variant="ghost"
            onClick={() => {
              setErrorMessage(null);
              setDialogOpen(true);
            }}
            disabled={isDeleting}
          >
            {isDeleting ? copy.dismissing : copy.dismiss}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        title={copy.confirmTitle}
        description={copy.confirmMessage}
        confirmLabel={copy.confirmButton}
        cancelLabel={copy.cancel}
        confirmVariant="primary"
        pending={isDeleting}
        pendingLabel={copy.dismissing}
        errorMessage={errorMessage}
        onCancel={() => {
          if (!isDeleting) {
            setDialogOpen(false);
            setErrorMessage(null);
          }
        }}
        onConfirm={() => void handleConfirm()}
      />
    </article>
  );
}
