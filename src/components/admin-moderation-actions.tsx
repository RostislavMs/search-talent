"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import FormTextarea from "@/components/ui/form-textarea";
import { apiFetch } from "@/lib/api-client";
import type { ModerationCopy } from "@/lib/moderation-copy";
import {
  isCommentReportTarget,
  type ModerationStatus,
  type ReportTargetType,
} from "@/lib/moderation";

type AdminModerationActionsProps = {
  copy: ModerationCopy;
  targetType: ReportTargetType;
  targetId: string;
  currentStatus: ModerationStatus | null;
  reportId?: string;
  /** The person a conversation report is about: their messaging can be limited. */
  ownerUserId?: string | null;
};

const RESTRICTIONS = [
  { key: "restrictNew7", scope: "new_conversations", days: 7 },
  { key: "restrictNew30", scope: "new_conversations", days: 30 },
  { key: "restrictAll30", scope: "all", days: 30 },
  { key: "restrictAllForever", scope: "all", days: null },
] as const;

export default function AdminModerationActions({
  copy,
  targetType,
  targetId,
  currentStatus,
  reportId,
  ownerUserId = null,
}: AdminModerationActionsProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  async function applyAction(action: {
    key: string;
    moderationStatus: ModerationStatus;
    reportStatus?: "triaged" | "resolved" | "dismissed";
  }) {
    setPendingAction(action.key);
    setFeedback("");
    setError("");

    const result = await apiFetch("/api/admin/moderation", {
      method: "POST",
      body: {
        targetType,
        targetId,
        moderationStatus: action.moderationStatus,
        reportId,
        reportStatus: action.reportStatus,
        resolutionNote: note,
      },
    });

    setPendingAction("");

    if (!result.ok) {
      setError(result.error || copy.actions.errorFallback);
      return;
    }

    setFeedback(copy.actions.success);
    setNote("");
    router.refresh();
  }

  async function restrict(item: (typeof RESTRICTIONS)[number]) {
    if (!ownerUserId) return;
    setPendingAction(item.key);
    setFeedback("");
    setError("");

    const result = await apiFetch("/api/admin/messaging-restrictions", {
      method: "POST",
      body: { userId: ownerUserId, scope: item.scope, days: item.days, note, reportId },
    });

    setPendingAction("");

    if (!result.ok) {
      setError(result.error || copy.actions.errorFallback);
      return;
    }

    setFeedback(copy.actions.success);
    setNote("");
    router.refresh();
  }

  const fallbackStatus = currentStatus || "approved";

  return (
    <div className="space-y-4 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <FormTextarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={4}
        maxLength={1200}
        placeholder={copy.actions.notePlaceholder}
        className="w-full bg-[color:var(--surface-muted)] px-4 py-3 text-sm leading-7 text-[color:var(--foreground)]"
      />

      {targetType === "conversation" ? (
        // A report about someone in a conversation: nothing on the
        // conversation itself changes. A single message is removed from the
        // snapshot above; the person's messaging can be limited here.
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={Boolean(pendingAction)}
              onClick={() =>
                applyAction({ key: "resolve", moderationStatus: "approved", reportStatus: "resolved" })
              }
            >
              {pendingAction === "resolve" ? copy.actions.saving : copy.actions.resolveReport}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={Boolean(pendingAction)}
              onClick={() =>
                applyAction({ key: "dismiss", moderationStatus: "approved", reportStatus: "dismissed" })
              }
            >
              {pendingAction === "dismiss" ? copy.actions.saving : copy.actions.dismissReport}
            </Button>
          </div>
          {ownerUserId ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-eyebrow app-soft">{copy.actions.restrictTitle}</p>
              <div className="flex flex-wrap gap-2">
                {RESTRICTIONS.map((item) => (
                  <Button
                    key={item.key}
                    variant="secondary"
                    size="sm"
                    disabled={Boolean(pendingAction)}
                    onClick={() => void restrict(item)}
                  >
                    {pendingAction === item.key ? copy.actions.saving : copy.actions[item.key]}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : isCommentReportTarget(targetType) ? (
        // A comment has no review: it stays, or it is deleted (into the
        // trash for 60 days) and its author is told.
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={Boolean(pendingAction)}
            onClick={() =>
              applyAction({ key: "remove", moderationStatus: "removed", reportStatus: "resolved" })
            }
          >
            {pendingAction === "remove" ? copy.actions.saving : copy.actions.removeComment}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={Boolean(pendingAction)}
            onClick={() =>
              applyAction({ key: "dismiss", moderationStatus: "approved", reportStatus: "dismissed" })
            }
          >
            {pendingAction === "dismiss" ? copy.actions.saving : copy.actions.keepComment}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={Boolean(pendingAction)}
            onClick={() =>
              applyAction({
                key: "approve",
                moderationStatus: "approved",
                reportStatus: "resolved",
              })
            }
          >
            {pendingAction === "approve"
              ? copy.actions.saving
              : copy.actions.saveApprove}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={Boolean(pendingAction)}
            onClick={() =>
              applyAction({
                key: "review",
                moderationStatus: "under_review",
                reportStatus: "triaged",
              })
            }
          >
            {pendingAction === "review"
              ? copy.actions.saving
              : copy.actions.saveReview}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={Boolean(pendingAction)}
            onClick={() =>
              applyAction({
                key: "restrict",
                moderationStatus: "restricted",
                reportStatus: "resolved",
              })
            }
          >
            {pendingAction === "restrict"
              ? copy.actions.saving
              : copy.actions.saveRestrict}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={Boolean(pendingAction)}
            onClick={() =>
              applyAction({
                key: "remove",
                moderationStatus: "removed",
                reportStatus: "resolved",
              })
            }
          >
            {pendingAction === "remove"
              ? copy.actions.saving
              : copy.actions.saveRemove}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={Boolean(pendingAction)}
            onClick={() =>
              applyAction({
                key: "dismiss",
                moderationStatus: fallbackStatus,
                reportStatus: "dismissed",
              })
            }
          >
            {pendingAction === "dismiss"
              ? copy.actions.saving
              : copy.actions.dismissReport}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={Boolean(pendingAction)}
            onClick={() =>
              applyAction({
                key: "resolve",
                moderationStatus: fallbackStatus,
                reportStatus: "resolved",
              })
            }
          >
            {pendingAction === "resolve"
              ? copy.actions.saving
              : copy.actions.resolveReport}
          </Button>
        </div>
      )}

      {feedback && <p className="text-sm text-emerald-600">{feedback}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
