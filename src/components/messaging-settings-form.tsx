"use client";

import { useId, useState } from "react";
import MessagingAvatar from "@/components/messaging-avatar";
import { Button } from "@/components/ui/Button";
import Switch from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import {
  personLabel,
  whoCanMessageOptions,
  type MessageBlock,
  type MessagingSettings,
  type WhoCanMessage,
} from "@/lib/messages";

/**
 * Who may write, the emails, read receipts, and the blocked list. Every
 * change saves at once; a failure puts the old value back.
 */
export default function MessagingSettingsForm({
  initialSettings,
  initialBlocks,
}: {
  initialSettings: MessagingSettings;
  initialBlocks: MessageBlock[];
}) {
  const copy = useDictionary().messages;
  const page = copy.settingsPage;
  const toast = useToast();
  const groupId = useId();
  const emailId = useId();
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
        <div role="radiogroup" aria-labelledby={groupId} className="mt-4 space-y-2">
          {whoCanMessageOptions.map((option: WhoCanMessage) => {
            const checked = settings.whoCanMessage === option;
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                  checked ? "border-[color:var(--foreground)]" : "app-border hover:bg-[color:var(--surface-muted)]"
                }`}
              >
                <input
                  type="radio"
                  name="who-can-message"
                  value={option}
                  checked={checked}
                  disabled={saving}
                  onChange={() => void save({ whoCanMessage: option })}
                  className="mt-1 accent-[color:var(--brand)]"
                />
                <span>
                  <span className="block text-sm font-medium text-[color:var(--foreground)]">{page.who[option].label}</span>
                  <span className="mt-0.5 block text-xs leading-5 app-muted">{page.who[option].hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="space-y-5 rounded-hero app-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id={emailId} className="text-sm font-medium text-[color:var(--foreground)]">
              {page.emailTitle}
            </p>
            <p id={`${emailId}-hint`} className="mt-1 text-xs leading-5 app-muted">
              {page.emailHint}
            </p>
          </div>
          <Switch
            checked={settings.emailNotifications}
            disabled={saving}
            labelledBy={emailId}
            describedBy={`${emailId}-hint`}
            onChange={(next) => void save({ emailNotifications: next })}
          />
        </div>
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
