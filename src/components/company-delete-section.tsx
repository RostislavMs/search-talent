"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useCurrentLocale, useDictionary } from "@/lib/i18n/client";
import { createLocalePath } from "@/lib/i18n/config";

/** The owner's "delete this page" block at the bottom of the editor. */
export default function CompanyDeleteSection({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const locale = useCurrentLocale();
  const copy = useDictionary().companies;
  const ui = copy.danger;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    const result = await apiFetch(`/api/companies/${companyId}`, { method: "DELETE" });
    setPending(false);

    if (!result.ok) {
      setError(ui.error);
      return;
    }

    setOpen(false);
    toast.success(ui.deleted);
    router.push(createLocalePath(locale, "/my-space/companies"));
    router.refresh();
  }

  return (
    <section
      className="rounded-none app-card p-5 sm:rounded-hero sm:p-6"
      aria-labelledby="company-delete-title"
    >
      <h2
        id="company-delete-title"
        className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
      >
        {ui.title}
      </h2>
      <p className="mt-1 text-sm leading-6 app-muted">{ui.description}</p>
      <Button
        variant="secondary"
        size="sm"
        className="mt-4 text-rose-600 dark:text-rose-400"
        onClick={() => setOpen(true)}
      >
        {ui.button}
      </Button>

      <ConfirmDialog
        open={open}
        title={ui.confirmTitle.replace("{company}", companyName)}
        description={ui.confirmText}
        confirmLabel={ui.button}
        cancelLabel={copy.team.confirmCancel}
        pending={pending}
        pendingLabel={ui.deleting}
        errorMessage={error}
        onConfirm={() => void remove()}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
      />
    </section>
  );
}
