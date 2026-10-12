"use client";

import { useId, useState } from "react";
import RadioCards from "@/components/ui/radio-cards";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import { messageEmailModes, type MessageEmailMode, type NotificationPreferences } from "@/lib/messages";

/**
 * Emails about new messages: at once, once a day, or never. The same choice
 * on the message settings and on the email settings page; it saves at once,
 * and a failure puts the old value back.
 */
export default function MessageEmailChoice({
  initialValue,
  title,
  hint,
}: {
  initialValue: MessageEmailMode;
  title: string;
  hint?: string;
}) {
  const copy = useDictionary().emailSettings;
  const toast = useToast();
  const headingId = useId();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function choose(next: MessageEmailMode) {
    if (next === value) return;

    const previous = value;
    setValue(next);
    setSaving(true);
    const result = await apiFetch<{ preferences: NotificationPreferences }>("/api/email-preferences", {
      method: "PATCH",
      body: { messageEmails: next },
    });
    setSaving(false);

    if (!result.ok) {
      setValue(previous);
      toast.error(copy.failed);
      return;
    }

    setValue(result.data.preferences.messageEmails);
    toast.success(copy.saved);
  }

  return (
    <div>
      <p id={headingId} className="text-sm font-medium text-[color:var(--foreground)]">
        {title}
      </p>
      {hint ? <p className="mt-1 text-xs leading-5 app-muted">{hint}</p> : null}
      <div className="mt-3">
        <RadioCards
          name={`message-emails-${headingId}`}
          value={value}
          labelledBy={headingId}
          disabled={saving}
          onChange={(next) => void choose(next)}
          options={messageEmailModes.map((mode) => ({
            value: mode,
            label: copy.messageModes[mode].label,
            hint: copy.messageModes[mode].hint,
          }))}
        />
      </div>
    </div>
  );
}
