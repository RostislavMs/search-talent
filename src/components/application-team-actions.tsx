"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import type { ApplicationStatus, TeamApplicationStatus } from "@/lib/applications";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

/**
 * What the team does with one application: shortlist, mark as hired, reject —
 * and take a decision back ("Back to review"). A rejection and a hire are
 * confirmed first, since the candidate hears about both.
 */
export default function ApplicationTeamActions({
  applicationId,
  status,
}: {
  applicationId: string;
  status: ApplicationStatus;
}) {
  const router = useLocalizedRouter();
  const toast = useToast();
  const ui = useDictionary().applications.team.actions;
  const [busy, setBusy] = useState<TeamApplicationStatus | null>(null);
  const [confirm, setConfirm] = useState<"rejected" | "hired" | null>(null);

  if (status === "withdrawn") {
    return null;
  }

  async function move(next: TeamApplicationStatus) {
    setBusy(next);
    const result = await apiFetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      body: { status: next },
    });
    setBusy(null);
    setConfirm(null);

    if (!result.ok) {
      toast.error(ui.error);
      return;
    }

    toast.success(ui.saved[next]);
    router.refresh();
  }

  const disabled = busy !== null;
  const label = (next: TeamApplicationStatus, text: string) => (busy === next ? ui.working : text);

  return (
    <div className="flex flex-wrap gap-2">
      {status === "new" || status === "viewed" ? (
        <Button size="sm" disabled={disabled} onClick={() => void move("shortlisted")}>
          {label("shortlisted", ui.shortlist)}
        </Button>
      ) : null}

      {status !== "hired" ? (
        <Button
          size="sm"
          variant={status === "shortlisted" ? "primary" : "secondary"}
          disabled={disabled}
          onClick={() => setConfirm("hired")}
        >
          {label("hired", ui.hire)}
        </Button>
      ) : null}

      {status !== "rejected" ? (
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setConfirm("rejected")}>
          {label("rejected", ui.reject)}
        </Button>
      ) : null}

      {status === "shortlisted" || status === "rejected" || status === "hired" ? (
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => void move("viewed")}>
          {label("viewed", ui.reconsider)}
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirm === "rejected"}
        title={ui.rejectTitle}
        description={ui.rejectText}
        confirmLabel={ui.rejectConfirm}
        cancelLabel={ui.cancel}
        pending={busy === "rejected"}
        pendingLabel={ui.working}
        onConfirm={() => void move("rejected")}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "hired"}
        title={ui.hireTitle}
        description={ui.hireText}
        confirmLabel={ui.hireConfirm}
        cancelLabel={ui.cancel}
        pending={busy === "hired"}
        pendingLabel={ui.working}
        onConfirm={() => void move("hired")}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
