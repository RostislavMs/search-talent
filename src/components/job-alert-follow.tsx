"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useCurrentLocale, useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import {
  JOB_ALERTS_PATH,
  JOB_ALERT_LIMITS,
  toJobAlertParams,
  type JobAlertFilters,
} from "@/lib/job-alerts";

function BellIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M4 6.5a4 4 0 1 1 8 0c0 3 1.2 4.3 1.5 4.5h-11C2.8 10.8 4 9.5 4 6.5Z" />
      <path d="M6.5 13a1.6 1.6 0 0 0 3 0" />
    </svg>
  );
}

/**
 * "Follow this search" on /jobs: the filters on screen become a job alert —
 * new vacancies like these every morning, in notifications and by email.
 * Pressed again, it stops following. A guest is sent to sign in and back.
 */
export default function JobAlertFollow({
  filters,
  alertId: initialAlertId,
  isAuthenticated,
  loginHref,
}: {
  filters: JobAlertFilters;
  /** The alert that already follows exactly these filters, if any. */
  alertId: string | null;
  isAuthenticated: boolean;
  loginHref: string;
}) {
  const copy = useDictionary().jobAlerts.follow;
  const locale = useCurrentLocale();
  const router = useLocalizedRouter();
  const toast = useToast();
  const [alertId, setAlertId] = useState(initialAlertId);
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated) {
    return (
      <ButtonLink href={loginHref} variant="secondary" size="sm" className="gap-2">
        <BellIcon />
        {copy.button}
      </ButtonLink>
    );
  }

  async function follow() {
    setBusy(true);
    const result = await apiFetch<{ alert: { id: string } }>("/api/job-alerts", {
      method: "POST",
      body: { filters: toJobAlertParams(filters), locale },
    });
    setBusy(false);

    if (result.ok) {
      setAlertId(result.data.alert.id);
      toast.success(copy.followed);
      return;
    }

    if (result.code === "duplicate") {
      // Followed in another tab: the page knows the alert after a refresh.
      router.refresh();
      return;
    }

    toast.error(
      result.code === "limit"
        ? copy.limit.replace("{max}", String(JOB_ALERT_LIMITS.perPerson))
        : result.status === 429
          ? copy.rateLimited
          : copy.error,
    );
  }

  async function unfollow() {
    if (!alertId) return;
    setBusy(true);
    const result = await apiFetch(`/api/job-alerts/${alertId}`, { method: "DELETE" });
    setBusy(false);

    if (result.ok || result.status === 404) {
      setAlertId(null);
      toast.success(copy.unfollowed);
      return;
    }

    toast.error(copy.error);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        variant="secondary"
        size="sm"
        className="gap-2"
        aria-pressed={Boolean(alertId)}
        disabled={busy}
        onClick={() => void (alertId ? unfollow() : follow())}
        title={alertId ? copy.unfollowHint : copy.hint}
      >
        <BellIcon />
        {alertId ? copy.following : copy.button}
      </Button>
      {alertId ? (
        <LocalizedLink
          href={JOB_ALERTS_PATH}
          className="text-sm font-medium text-[color:var(--brand-ink)] underline-offset-4 hover:underline"
        >
          {copy.manage}
        </LocalizedLink>
      ) : null}
    </div>
  );
}
