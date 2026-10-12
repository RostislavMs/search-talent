"use client";

import { useId, useState } from "react";
import MessageEmailChoice from "@/components/message-email-choice";
import LocalizedLink from "@/components/ui/localized-link";
import Switch from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import { JOB_ALERTS_PATH } from "@/lib/job-alerts";
import type { NotificationPreferences } from "@/lib/messages";

/**
 * Every email with a choice, in one place: new messages (at once, once a
 * day, never), new followers, and a way to the job alerts, which keep their
 * own switch per search. Each change saves at once.
 */
export default function EmailSettingsForm({ initialPreferences }: { initialPreferences: NotificationPreferences }) {
  const copy = useDictionary().emailSettings;
  const toast = useToast();
  const followersId = useId();
  const [followerEmails, setFollowerEmails] = useState(initialPreferences.followerEmails);
  const [saving, setSaving] = useState(false);

  async function saveFollowers(next: boolean) {
    const previous = followerEmails;
    setFollowerEmails(next);
    setSaving(true);
    const result = await apiFetch<{ preferences: NotificationPreferences }>("/api/email-preferences", {
      method: "PATCH",
      body: { followerEmails: next },
    });
    setSaving(false);

    if (!result.ok) {
      setFollowerEmails(previous);
      toast.error(copy.failed);
      return;
    }

    setFollowerEmails(result.data.preferences.followerEmails);
    toast.success(copy.saved);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-hero app-card p-5 sm:p-6">
        <MessageEmailChoice
          initialValue={initialPreferences.messageEmails}
          title={copy.messagesTitle}
          hint={copy.messagesHint}
        />
      </section>

      <section className="rounded-hero app-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id={followersId} className="text-sm font-medium text-[color:var(--foreground)]">
              {copy.followersTitle}
            </p>
            <p id={`${followersId}-hint`} className="mt-1 text-xs leading-5 app-muted">
              {copy.followersHint}
            </p>
          </div>
          <Switch
            checked={followerEmails}
            disabled={saving}
            labelledBy={followersId}
            describedBy={`${followersId}-hint`}
            onChange={(next) => void saveFollowers(next)}
          />
        </div>
      </section>

      <section className="rounded-hero app-card p-5 sm:p-6">
        <p className="text-sm font-medium text-[color:var(--foreground)]">{copy.jobAlertsTitle}</p>
        <p className="mt-1 text-xs leading-5 app-muted">{copy.jobAlertsHint}</p>
        <LocalizedLink
          href={JOB_ALERTS_PATH}
          className="mt-3 inline-block text-sm font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4 transition-colors hover:decoration-[color:var(--foreground)]"
        >
          {copy.jobAlertsLink}
        </LocalizedLink>
      </section>
    </div>
  );
}
