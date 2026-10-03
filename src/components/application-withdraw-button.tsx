"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

/** "Withdraw" in "My applications", confirmed first: there is no applying again. */
export default function ApplicationWithdrawButton({
  applicationId,
  vacancyTitle,
}: {
  applicationId: string;
  vacancyTitle: string;
}) {
  const router = useLocalizedRouter();
  const toast = useToast();
  const ui = useDictionary().applications.mine;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function withdraw() {
    setBusy(true);
    const result = await apiFetch(`/api/applications/${applicationId}/withdraw`, { method: "POST" });
    setBusy(false);
    setOpen(false);

    if (!result.ok) {
      toast.error(ui.error);
      return;
    }

    toast.success(ui.withdrawn);
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(true)}>
        {ui.withdraw}
      </Button>
      <ConfirmDialog
        open={open}
        title={ui.withdrawTitle.replace("{title}", vacancyTitle)}
        description={ui.withdrawText}
        confirmLabel={ui.withdraw}
        cancelLabel={ui.cancel}
        pending={busy}
        pendingLabel={ui.working}
        onConfirm={() => void withdraw()}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
