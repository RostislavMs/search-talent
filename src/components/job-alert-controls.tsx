"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import Switch from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useCurrentLocale, useDictionary, useLocalizedRouter } from "@/lib/i18n/client";

/** Switches an alert's morning email on or off. */
function useEmailSwitch(alertId: string | null, initial: boolean) {
  const toast = useToast();
  const copy = useDictionary().jobAlerts.page;
  const [notifyEmail, setNotifyEmail] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function change(next: boolean) {
    if (!alertId) return;
    setNotifyEmail(next);
    setBusy(true);
    const result = await apiFetch(`/api/job-alerts/${alertId}`, { method: "PATCH", body: { notifyEmail: next } });
    setBusy(false);

    if (!result.ok) {
      setNotifyEmail(!next);
      toast.error(copy.error);
    }
  }

  return { notifyEmail, busy, change };
}

function EmailSwitch({ alertId, notifyEmail: initial }: { alertId: string; notifyEmail: boolean }) {
  const copy = useDictionary().jobAlerts.page;
  const labelId = useId();
  const { notifyEmail, busy, change } = useEmailSwitch(alertId, initial);

  return (
    <div className="flex items-center gap-2">
      <Switch size="sm" checked={notifyEmail} onChange={(next) => void change(next)} disabled={busy} labelledBy={labelId} />
      <span id={labelId} className="text-sm text-[color:var(--foreground)]">
        {copy.email}
      </span>
    </div>
  );
}

/** One followed search: email on or off, and "Remove" (confirmed). */
export function JobAlertControls({
  alertId,
  name,
  notifyEmail,
}: {
  alertId: string;
  name: string;
  notifyEmail: boolean;
}) {
  const copy = useDictionary().jobAlerts.page;
  const router = useLocalizedRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const result = await apiFetch(`/api/job-alerts/${alertId}`, { method: "DELETE" });
    setBusy(false);
    setConfirming(false);

    if (!result.ok && result.status !== 404) {
      toast.error(copy.error);
      return;
    }

    toast.success(copy.removed);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <EmailSwitch alertId={alertId} notifyEmail={notifyEmail} />
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
        {copy.remove}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={copy.removeTitle.replace("{name}", name)}
        description={copy.removeText}
        confirmLabel={copy.remove}
        cancelLabel={copy.cancel}
        pending={busy}
        pendingLabel={copy.working}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

/**
 * "Vacancies that fit me": on creates the alert (email on), off removes it.
 * Used on the alerts page (with the email switch) and in My Space under
 * «Відкрито до…».
 */
export function JobAlertProfileSwitch({
  alertId: initialAlertId,
  notifyEmail,
  title,
  hint,
  disabled = false,
  showEmail = false,
}: {
  alertId: string | null;
  notifyEmail: boolean;
  title: string;
  hint: string;
  disabled?: boolean;
  showEmail?: boolean;
}) {
  const copy = useDictionary().jobAlerts.page;
  const locale = useCurrentLocale();
  const router = useLocalizedRouter();
  const toast = useToast();
  const titleId = useId();
  const hintId = useId();
  const [alertId, setAlertId] = useState(initialAlertId);
  const [busy, setBusy] = useState(false);

  async function change(next: boolean) {
    setBusy(true);

    if (next) {
      const result = await apiFetch<{ alert: { id: string } }>("/api/job-alerts", {
        method: "POST",
        body: { match: "profile", locale },
      });
      setBusy(false);

      if (result.ok) {
        setAlertId(result.data.alert.id);
        toast.success(copy.profileOn);
        router.refresh();
      } else if (result.code === "duplicate") {
        router.refresh();
      } else {
        toast.error(result.code === "limit" ? copy.limit : copy.error);
      }
      return;
    }

    if (!alertId) {
      setBusy(false);
      return;
    }

    const result = await apiFetch(`/api/job-alerts/${alertId}`, { method: "DELETE" });
    setBusy(false);

    if (result.ok || result.status === 404) {
      setAlertId(null);
      router.refresh();
    } else {
      toast.error(copy.error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p id={titleId} className="font-medium text-[color:var(--foreground)]">
            {title}
          </p>
          <p id={hintId} className="mt-1 text-sm leading-6 app-muted">
            {hint}
          </p>
        </div>
        <Switch
          checked={Boolean(alertId)}
          onChange={(next) => void change(next)}
          disabled={disabled || busy}
          labelledBy={titleId}
          describedBy={hintId}
        />
      </div>
      {showEmail && alertId ? <EmailSwitch key={alertId} alertId={alertId} notifyEmail={notifyEmail} /> : null}
    </div>
  );
}
