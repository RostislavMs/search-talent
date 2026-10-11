"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { ModerationCopy } from "@/lib/moderation-copy";

/**
 * "Delete this message" next to a message in a conversation report's
 * snapshot: the text is erased in the conversation for both sides (the
 * snapshot keeps it). The report itself is answered separately.
 */
export default function AdminSnapshotMessageRemove({
  messageId,
  copy,
}: {
  messageId: string;
  copy: ModerationCopy;
}) {
  const [state, setState] = useState<"idle" | "pending" | "done" | "error">("idle");

  async function remove() {
    setState("pending");
    const result = await apiFetch("/api/admin/moderation", {
      method: "POST",
      body: { targetType: "message", targetId: messageId, moderationStatus: "removed" },
    });
    setState(result.ok ? "done" : "error");
  }

  if (state === "done") {
    return <span className="text-xs app-soft">{copy.dashboard.snapshotDeleted}</span>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={state === "pending"}
        onClick={() => void remove()}
        className="cursor-pointer text-xs font-medium text-rose-600 underline-offset-2 transition-colors hover:underline disabled:cursor-wait dark:text-rose-400"
      >
        {state === "pending" ? copy.actions.saving : copy.actions.removeMessage}
      </button>
      {state === "error" ? <span className="text-xs text-rose-600">{copy.actions.errorFallback}</span> : null}
    </span>
  );
}
