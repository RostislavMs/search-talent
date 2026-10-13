"use client";

import { useId, useState } from "react";
import MessageEmailChoice from "@/components/message-email-choice";
import MessagingAvatar from "@/components/messaging-avatar";
import { Button } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import RadioCards from "@/components/ui/radio-cards";
import Switch from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import { messagesCopy } from "@/lib/i18n/copy/messages";
import {
  NOTIFICATION_SETTINGS_PATH,
  personLabel,
  whoCanMessageOptions,
  type MessageBlock,
  type MessagingSettings,
} from "@/lib/messages";

/**
 * Who may write, the emails, read receipts, and the blocked list. Every
 * change saves at once; a failure puts the old value back. The email choice
 * is the same one as on the email settings page.
 */
export default function MessagingSettingsForm({
  initialSettings,
  initialBlocks,
}: {
  initialSettings: MessagingSettings;
  initialBlocks: MessageBlock[];
}) {
  const copy = useDictionary({ messages: messagesCopy }).messages;
  const page = copy.settingsPage;
  const toast = useToast();
  const groupId = useId();
  const receiptsId = useId();
  const [settings, setSettings] = useState(initialSettings);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function save(patch: Partial<MessagingSettings>) {
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setSaving(true);
    const result = await apiFetch<{ settings: MessagingSettings }>("/api/messages/settings", {
      method: "PATCH",
      body: patch,
    });
    setSaving(false);

    if (!result.ok) {
      setSettings(previous);
      toast.error(page.failed);
      return;
    }

    setSettings(result.data.settings);
    toast.success(page.saved);
  }

  async function unblock(block: MessageBlock) {
    setRemoving(block.id);
    const result = await apiFetch(`/api/messages/blocks/${block.id}`, { method: "DELETE" });
    setRemoving(null);

    if (!result.ok) {
      toast.error(page.failed);
      return;
    }

    setBlocks((current) => current.filter((item) => item.id !== block.id));
    toast.success(copy.toasts.unblocked);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-hero app-card p-5 sm:p-6">
        <h2 id={groupId} className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
          {page.whoTitle}
        </h2>
        <div className="mt-4">
          <RadioCards
            name="who-can-message"
            value={settings.whoCanMessage}
            labelledBy={groupId}
            disabled={saving}
            onChange={(option) => void save({ whoCanMessage: option })}
            options={whoCanMessageOptions.map((option) => ({
              value: option,
              label: page.who[option].label,
              hint: page.who[option].hint,
            }))}
          />
        </div>
      </section>

      <section className="space-y-5 rounded-hero app-card p-5 sm:p-6">
        <MessageEmailChoice initialValue={settings.messageEmails} title={page.emailTitle} hint={page.emailHint} />
        <p className="text-xs app-muted">
          <LocalizedLink
            href={NOTIFICATION_SETTINGS_PATH}
            className="font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4 transition-colors hover:decoration-[color:var(--foreground)]"
          >
            {page.allEmails}
          </LocalizedLink>
        </p>
        <div className="flex items-start justify-between gap-4 border-t app-border pt-5">
          <div>
            <p id={receiptsId} className="text-sm font-medium text-[color:var(--foreground)]">
              {page.receiptsTitle}
            </p>
            <p id={`${receiptsId}-hint`} className="mt-1 text-xs leading-5 app-muted">
              {page.receiptsHint}
            </p>
          </div>
          <Switch
            checked={settings.readReceipts}
            disabled={saving}
            labelledBy={receiptsId}
            describedBy={`${receiptsId}-hint`}
            onChange={(next) => void save({ readReceipts: next })}
          />
        </div>
      </section>

      <section className="rounded-hero app-card p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]">{page.blocksTitle}</h2>
        {blocks.length === 0 ? (
          <p className="mt-3 text-sm app-muted">{page.blocksEmpty}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {blocks.map((block) => {
              const name = block.company
                ? block.company.name
                : personLabel(block.person, copy.deletedAccount);
              return (
                <li key={block.id} className="flex items-center gap-3 rounded-2xl border app-border px-4 py-3">
                  <MessagingAvatar
                    size="sm"
                    label={name}
                    imageUrl={block.company ? block.company.logoUrl : (block.person?.avatarUrl ?? null)}
                    isCompany={Boolean(block.company)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[color:var(--foreground)]">{name}</span>
                    {block.byCompany ? (
                      <span className="block truncate text-xs app-muted">
                        {page.blockedByCompany.replace("{company}", block.byCompany.name)}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={removing === block.id}
                    onClick={() => void unblock(block)}
                  >
                    {page.unblock}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
