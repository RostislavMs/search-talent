"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import { JOB_ALERTS_PATH } from "@/lib/job-alerts";

/**
 * The button behind "Turn these emails off" in a job alert email. A press,
 * not the visit itself: mail scanners open links on their own.
 */
export default function JobAlertUnsubscribe({ userId, token }: { userId: string; token: string }) {
  const copy = useDictionary().jobAlerts.unsubscribe;
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function unsubscribe() {
    setState("busy");
    const result = await apiFetch("/api/job-alerts/unsubscribe", {
      method: "POST",
      body: { u: userId, t: token },
    });
    setState(result.ok ? "done" : "error");
  }

  if (state === "done") {
    return (
      <div role="status">
        <p className="text-base leading-7 text-[color:var(--foreground)]">{copy.done}</p>
        <div className="mt-5">
          <ButtonLink href={JOB_ALERTS_PATH} variant="secondary">
            {copy.manage}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-base leading-7 app-muted">{copy.text}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => void unsubscribe()} disabled={state === "busy"}>
          {state === "busy" ? copy.working : copy.button}
        </Button>
        <ButtonLink href={JOB_ALERTS_PATH} variant="ghost">
          {copy.manage}
        </ButtonLink>
      </div>
      {state === "error" ? (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-400" role="alert">
          {copy.error}
        </p>
      ) : null}
    </div>
  );
}
