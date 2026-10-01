"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import {
  canExtendVacancy,
  resolveVacancyState,
  type VacancyStatus,
} from "@/lib/vacancies";
import type { VacancyReadinessIssue, VacancyStatusAction } from "@/lib/validation/vacancies";

/**
 * What the team does with a vacancy besides editing it: publish a draft,
 * close an open one, give it 60 more days (or reopen it), delete it. The same
 * buttons on the vacancy page and in the team's list.
 */
export default function VacancyStatusActions({
  vacancyId,
  title,
  status,
  expiresAt,
  canDelete,
  showEdit = true,
  showPublish = true,
  afterDeleteHref = "/my-space/vacancies",
}: {
  vacancyId: string;
  title: string;
  status: VacancyStatus;
  expiresAt: string | null;
  /** The author, an owner or an admin of the company (the database agrees). */
  canDelete: boolean;
  showEdit?: boolean;
  /** Off in the editor, whose own "Publish" saves the form first. */
  showPublish?: boolean;
  afterDeleteHref?: string;
}) {
  const router = useLocalizedRouter();
  const toast = useToast();
  const copy = useDictionary().vacancies;
  const ui = copy.actions;
  const [busy, setBusy] = useState<VacancyStatusAction | "delete" | null>(null);
  const [confirm, setConfirm] = useState<"close" | "delete" | null>(null);

  const state = resolveVacancyState({ status, expiresAt });
  const extendable = canExtendVacancy({ status, expiresAt });

  async function run(action: VacancyStatusAction) {
    setBusy(action);
    const result = await apiFetch<{ heldForReview?: boolean }>(
      `/api/vacancies/${vacancyId}/status`,
      { method: "POST", body: { action } },
    );
    setBusy(null);
    setConfirm(null);

    if (!result.ok) {
      // A draft that is not complete yet says what is missing.
      const issue = result.code as VacancyReadinessIssue | undefined;
      toast.error(issue && issue in copy.form.errors ? copy.form.errors[issue] : ui.error);
      return;
    }

    if (result.data.heldForReview) {
      toast.warning(copy.form.heldForReview);
    } else {
      toast.success(
        action === "publish" ? ui.published : action === "close" ? ui.closed : ui.extended,
      );
    }
    router.refresh();
  }

  async function remove() {
    setBusy("delete");
    const result = await apiFetch(`/api/vacancies/${vacancyId}`, { method: "DELETE" });
    setBusy(null);
    setConfirm(null);

    if (!result.ok) {
      toast.error(ui.error);
      return;
    }

    toast.success(ui.deleted);
    router.push(afterDeleteHref);
    router.refresh();
  }

  const disabled = busy !== null;

  return (
    <div className="flex flex-wrap gap-2">
      {showEdit ? (
        <ButtonLink href={`/jobs/edit/${vacancyId}`} variant="secondary" size="sm">
          {ui.edit}
        </ButtonLink>
      ) : null}

      {state === "draft" && showPublish ? (
        <Button size="sm" disabled={disabled} onClick={() => void run("publish")}>
          {busy === "publish" ? ui.working : ui.publish}
        </Button>
      ) : null}

      {state === "open" && extendable ? (
        <Button size="sm" disabled={disabled} onClick={() => void run("extend")}>
          {busy === "extend" ? ui.working : ui.extend}
        </Button>
      ) : null}

      {state === "closed" || state === "expired" ? (
        <Button size="sm" disabled={disabled} onClick={() => void run("extend")}>
          {busy === "extend" ? ui.working : ui.reopen}
        </Button>
      ) : null}

      {status === "published" ? (
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setConfirm("close")}>
          {ui.close}
        </Button>
      ) : null}

      {canDelete ? (
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setConfirm("delete")}>
          {ui.delete}
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirm === "close"}
        title={ui.closeTitle.replace("{title}", title)}
        description={ui.closeText}
        confirmLabel={ui.close}
        cancelLabel={ui.cancel}
        onConfirm={() => void run("close")}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        title={ui.deleteTitle.replace("{title}", title)}
        description={ui.deleteText}
        confirmLabel={ui.delete}
        cancelLabel={ui.cancel}
        onConfirm={() => void remove()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
