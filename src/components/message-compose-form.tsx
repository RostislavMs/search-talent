"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/button-styles";
import FormTextarea from "@/components/ui/form-textarea";
import LocalizedLink from "@/components/ui/localized-link";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import {
  buildConversationPath,
  hasExternalLink,
  MESSAGE_MAX_LENGTH,
  newClientId,
  toRefusalCode,
} from "@/lib/messages";

type StartResponse = { conversationId: string; messageId: string; created: boolean };

/**
 * The first message to someone, from their profile or an application. One
 * form for every entry point; the database decides whether it may go and
 * whether it is a request (one message, no outside links).
 */
export default function MessageComposeForm({
  recipientUserId,
  companyId = null,
  applicationId = null,
  requestHint = true,
  autoFocus = false,
  onSent,
  onCancel,
}: {
  recipientUserId: string;
  /** Write as this company (the sender is in its team). */
  companyId?: string | null;
  applicationId?: string | null;
  /** Show the request rules: a cold first message, not an answer to an application. */
  requestHint?: boolean;
  autoFocus?: boolean;
  onSent?: (conversationId: string) => void;
  onCancel?: () => void;
}) {
  const copy = useDictionary().messages;
  const fieldId = useId();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // One id per text: a retry after a lost answer is not a second message.
  const clientIdRef = useRef<{ text: string; id: string } | null>(null);

  const trimmed = body.trim();
  const tooLong = trimmed.length > MESSAGE_MAX_LENGTH;
  const linkWarning = requestHint && hasExternalLink(trimmed);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed || tooLong || sending) return;

    if (!clientIdRef.current || clientIdRef.current.text !== trimmed) {
      clientIdRef.current = { text: trimmed, id: newClientId() };
    }

    setSending(true);
    setError(null);

    const result = await apiFetch<StartResponse>("/api/messages/conversations", {
      method: "POST",
      body: {
        recipientUserId,
        body: trimmed,
        clientId: clientIdRef.current.id,
        companyId,
        applicationId,
      },
    });

    setSending(false);

    if (!result.ok) {
      setError(copy.errors[toRefusalCode(result.code)]);
      return;
    }

    setSentTo(result.data.conversationId);
    setBody("");
    clientIdRef.current = null;
    onSent?.(result.data.conversationId);
  }

  if (sentTo) {
    return (
      <div className="rounded-xl bg-[color:var(--surface-muted)] p-4" role="status">
        <p className="text-sm font-medium text-[color:var(--foreground)]">{copy.compose.sent}</p>
        <LocalizedLink
          href={buildConversationPath(sentTo)}
          className={buttonStyles({ size: "sm", className: "mt-3" })}
        >
          {copy.compose.openConversation}
        </LocalizedLink>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor={fieldId} className="sr-only">
        {copy.composer.label}
      </label>
      <FormTextarea
        id={fieldId}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        maxAutoHeight={260}
        maxLength={MESSAGE_MAX_LENGTH + 200}
        placeholder={copy.composer.placeholder}
        autoFocus={autoFocus}
        aria-invalid={tooLong || undefined}
        className="w-full bg-[color:var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]"
      />

      {requestHint ? <p className="text-xs leading-5 app-muted">{copy.request.rulesHint}</p> : null}
      {linkWarning ? (
        <p className="text-xs leading-5 text-amber-700 dark:text-amber-400">{copy.composer.linkWarning}</p>
      ) : null}
      {tooLong ? (
        <p className="text-xs text-rose-600 dark:text-rose-400">{copy.errors.too_long}</p>
      ) : trimmed.length > MESSAGE_MAX_LENGTH - 500 ? (
        <p className="text-xs app-soft">
          {copy.composer.counter.replace("{count}", String(trimmed.length)).replace("{max}", String(MESSAGE_MAX_LENGTH))}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={!trimmed || tooLong || sending}>
          {sending ? copy.compose.sending : copy.compose.send}
        </Button>
        {onCancel ? (
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={sending}>
            {copy.compose.cancel}
          </Button>
        ) : null}
      </div>
      <p className="text-xs leading-5 app-soft">{copy.compose.note}</p>
    </form>
  );
}
