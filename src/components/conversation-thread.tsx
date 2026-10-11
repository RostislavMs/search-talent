"use client";

import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ContentReportButton from "@/components/content-report-button";
import MessagingAvatar from "@/components/messaging-avatar";
import { useMessagingEvents } from "@/components/messaging-realtime-provider";
import { Button } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import FormTextarea from "@/components/ui/form-textarea";
import LocalizedLink from "@/components/ui/localized-link";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import {
  conversationPartner,
  hasExternalLink,
  lastReadOwnMessageId,
  mergeMessages,
  MESSAGE_MAX_LENGTH,
  MESSAGES_FALLBACK_POLL_MS,
  MESSAGES_PATH,
  messageDayKey,
  newClientId,
  personLabel,
  splitMessageText,
  toRefusalCode,
  type ChatMessage,
  type ConversationView,
} from "@/lib/messages";
import {
  describeMessageEvent,
  formatMessageDay,
  formatMessageTime,
} from "@/lib/messages-presentation";
import { getModerationCopy } from "@/lib/moderation-copy";

type Pending = { clientId: string; body: string; status: "sending" | "failed"; error: string | null };

type ConversationResponse = { conversation: ConversationView; messages: ChatMessage[] };

const NEAR_BOTTOM_PX = 140;

function MessageText({ text, onDark }: { text: string; onDark: boolean }) {
  const copy = useDictionary().messages;

  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-6">
      {splitMessageText(text).map((part, index) =>
        part.type === "text" ? (
          <Fragment key={index}>{part.value}</Fragment>
        ) : (
          <a
            key={index}
            href={part.href}
            target={part.external ? "_blank" : undefined}
            rel={part.external ? "nofollow ugc noopener noreferrer" : undefined}
            title={part.external ? copy.thread.externalLink.replace("{host}", part.host) : undefined}
            className={`break-all underline underline-offset-2 ${onDark ? "decoration-current/60" : "decoration-[color:var(--border)] hover:decoration-[color:var(--foreground)]"}`}
          >
            {part.label}
          </a>
        ),
      )}
    </p>
  );
}

/**
 * One conversation: the header (who, the applications it is about, the
 * menu), the messages by day, a request's choices, and the box to write in.
 * New messages arrive over the live connection (or every few seconds without
 * it); the conversation is marked read only while the tab is visible.
 */
export default function ConversationThread({
  initialView,
  initialMessages,
  locale,
  listQuery,
  isAuthenticated,
}: {
  initialView: ConversationView;
  initialMessages: ChatMessage[];
  locale: string;
  /** The list's ?box=&company=, for "All conversations". */
  listQuery: string;
  isAuthenticated: boolean;
}) {
  const dictionary = useDictionary();
  const copy = dictionary.messages;
  const moderationCopy = getModerationCopy(locale === "uk" ? "uk" : "en");
  const router = useLocalizedRouter();
  const toast = useToast();
  const composerId = useId();
  const menuId = useId();

  const [view, setView] = useState(initialView);
  const [messages, setMessages] = useState(initialMessages);
  const [pending, setPending] = useState<Pending[]>([]);
  const [hasOlder, setHasOlder] = useState(initialMessages.length >= 50);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  // Where the menu opens: under the button, against the right edge.
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [confirm, setConfirm] = useState<"clear" | "block" | null>(null);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const stickToBottom = useRef(true);
  const restoreFrom = useRef<number | null>(null);
  const readTimer = useRef<number | null>(null);
  const lastMarked = useRef(initialView.myLastReadSeq);

  const conversationId = view.id;
  const partner = conversationPartner(view, view.kind === "company" && view.side === "person" ? copy.companyUnavailable : copy.deletedAccount);
  const maxSeq = messages.length > 0 ? messages[messages.length - 1].seq : 0;
  const readOwnId = lastReadOwnMessageId(messages, view.theirLastReadSeq);

  // --- Loading -----------------------------------------------------------------

  const refreshView = useCallback(async () => {
    const result = await apiFetch<ConversationResponse>(`/api/messages/conversations/${conversationId}`);
    if (result.ok && result.data.conversation) {
      setView(result.data.conversation);
      setMessages((current) => mergeMessages(current, result.data.messages ?? []));
    }
  }, [conversationId]);

  const catchUp = useCallback(async () => {
    const after = messages.length > 0 ? messages[messages.length - 1].seq : 0;
    const result = await apiFetch<{ messages: ChatMessage[] }>(
      `/api/messages/conversations/${conversationId}/messages?after=${after}`,
    );
    const incoming = result.ok ? (result.data.messages ?? []) : [];
    if (incoming.length > 0) {
      setMessages((current) => mergeMessages(current, incoming));
    }
  }, [conversationId, messages]);

  const loadMessage = useCallback(async (messageId: string) => {
    const result = await apiFetch<{ message: ChatMessage & { conversationId: string } }>(`/api/messages/message/${messageId}`);
    const message = result.ok ? result.data.message : null;
    if (message && message.conversationId === conversationId) {
      setMessages((current) => mergeMessages(current, [message]));
    }
  }, [conversationId]);

  const { live } = useMessagingEvents((event) => {
    if (event.type === "reconnect") {
      void catchUp();
      void refreshView();
      return;
    }
    if (event.conversationId !== conversationId) return;

    if (event.type === "message" || event.type === "message_updated") {
      void loadMessage(event.messageId);
    } else {
      void refreshView();
    }
  });

  useEffect(() => {
    if (live) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void catchUp();
    }, MESSAGES_FALLBACK_POLL_MS);
    return () => window.clearInterval(id);
  }, [live, catchUp]);

  async function loadOlder() {
    const first = messages[0];
    if (!first) return;

    setLoadingOlder(true);
    const result = await apiFetch<{ messages: ChatMessage[] }>(
      `/api/messages/conversations/${conversationId}/messages?before=${first.seq}`,
    );
    setLoadingOlder(false);

    if (!result.ok) {
      toast.error(copy.loadFailed);
      return;
    }

    const older = result.data.messages ?? [];
    restoreFrom.current = scrollRef.current ? scrollRef.current.scrollHeight - scrollRef.current.scrollTop : null;
    setMessages((current) => mergeMessages(current, older));
    setHasOlder(older.length >= 50);
  }

  // --- Read --------------------------------------------------------------------

  const markRead = useCallback(() => {
    if (document.visibilityState !== "visible" || maxSeq <= lastMarked.current) return;
    const hasNewFromThem = messages.some((message) => !message.fromMySide && message.seq > lastMarked.current);
    if (!hasNewFromThem && view.myLastReadSeq >= maxSeq) return;

    const seq = maxSeq;
    lastMarked.current = seq;
    void apiFetch(`/api/messages/conversations/${conversationId}/read`, { method: "POST", body: { seq } });
  }, [conversationId, maxSeq, messages, view.myLastReadSeq]);

  useEffect(() => {
    if (readTimer.current !== null) window.clearTimeout(readTimer.current);
    readTimer.current = window.setTimeout(markRead, 400);
    return () => {
      if (readTimer.current !== null) window.clearTimeout(readTimer.current);
    };
  }, [markRead]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        markRead();
        void catchUp();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead, catchUp]);

  // --- Scrolling -----------------------------------------------------------------

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    if (restoreFrom.current !== null) {
      node.scrollTop = node.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
      return;
    }

    if (stickToBottom.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, pending]);

  const onScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < NEAR_BOTTOM_PX;
  };

  // --- Sending -------------------------------------------------------------------

  async function deliver(item: Pending) {
    const result = await apiFetch<{ messageId: string }>(`/api/messages/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { body: item.body, clientId: item.clientId },
    });

    if (!result.ok) {
      const code = toRefusalCode(result.code);
      setPending((current) =>
        current.map((entry) =>
          entry.clientId === item.clientId ? { ...entry, status: "failed", error: copy.errors[code] } : entry,
        ),
      );
      if (code === "awaiting_reply" || code === "blocked" || code === "closed" || code === "restricted") {
        void refreshView();
      }
      return;
    }

    await loadMessage(result.data.messageId);
    setPending((current) => current.filter((entry) => entry.clientId !== item.clientId));
    if (view.state === "request" || view.requestRules) {
      void refreshView();
    }
  }

  function send() {
    const text = body.replace(/\r/g, "").trim();
    if (!text || text.length > MESSAGE_MAX_LENGTH) return;

    const item: Pending = { clientId: newClientId(), body: text, status: "sending", error: null };
    stickToBottom.current = true;
    setPending((current) => [...current, item]);
    setBody("");
    void deliver(item);
  }

  function retry(item: Pending) {
    const next: Pending = { ...item, status: "sending", error: null };
    setPending((current) => current.map((entry) => (entry.clientId === item.clientId ? next : entry)));
    void deliver(next);
  }

  function onComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    // On a touch screen Enter is a new line; the button sends.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    event.preventDefault();
    send();
  }

  // --- Actions ---------------------------------------------------------------------

  async function act(action: "accept" | "archive" | "mute" | "clear" | "block", value?: boolean) {
    setBusy(action);
    const result = await apiFetch(`/api/messages/conversations/${conversationId}`, {
      method: "PATCH",
      body: value === undefined ? { action } : { action, value },
    });
    setBusy(null);
    setConfirm(null);
    setMenuOpen(false);

    if (!result.ok) {
      toast.error(copy.toasts.failed);
      return;
    }

    if (action === "clear") {
      toast.success(copy.toasts.cleared);
      router.push(`${MESSAGES_PATH}${listQuery}`);
      router.refresh();
      return;
    }

    const message =
      action === "accept"
        ? copy.toasts.accepted
        : action === "archive"
          ? value ? copy.toasts.archived : copy.toasts.unarchived
          : action === "mute"
            ? value ? copy.toasts.muted : copy.toasts.unmuted
            : value ? copy.toasts.blocked : copy.toasts.unblocked;
    toast.success(message);
    await refreshView();
    router.refresh();
  }

  // Close the menu on outside click and Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      const panel = document.getElementById(menuId);
      if (target && !panel?.contains(target) && !menuButtonRef.current?.contains(target)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, menuId]);

  const blockedByMe = view.blocked === "by_me";

  const menuItems: Array<{ key: string; label: string; onSelect: () => void }> = [
    {
      key: "archive",
      label: view.archived ? copy.menu.unarchive : copy.menu.archive,
      onSelect: () => void act("archive", !view.archived),
    },
    {
      key: "mute",
      label: view.muted ? copy.menu.unmute : copy.menu.mute,
      onSelect: () => void act("mute", !view.muted),
    },
    {
      key: "block",
      label: blockedByMe ? copy.menu.unblock : copy.menu.block,
      onSelect: () => (blockedByMe ? void act("block", false) : (setMenuOpen(false), setConfirm("block"))),
    },
    { key: "clear", label: copy.menu.clear, onSelect: () => (setMenuOpen(false), setConfirm("clear")) },
    // One report per conversation, about the other side; nothing to report
    // once that side is gone.
    ...(partner.available
      ? [{ key: "report", label: copy.menu.report, onSelect: () => (setMenuOpen(false), setReporting(true)) }]
      : []),
  ];

  // --- Rendering -------------------------------------------------------------------

  const trimmed = body.trim();
  const tooLong = trimmed.length > MESSAGE_MAX_LENGTH;
  const linkWarning = view.requestRules && hasExternalLink(trimmed);
  const cannotSend = !view.canSend
    ? copy.cannotSend[(view.cannotSendReason ?? "not_found") as keyof typeof copy.cannotSend] ?? copy.cannotSend.not_found
    : null;
  const statusLabels = view.side === "company" ? dictionary.applications.teamStatuses : dictionary.applications.candidateStatuses;
  const subtitle =
    view.kind === "company" && view.side === "person"
      ? view.company && !view.company.verified
        ? copy.thread.unverifiedCompany
        : null
      : view.side === "company" && view.company
        ? copy.thread.companyTeam.replace("{company}", view.company.name)
        : view.counterpart?.available
          ? view.counterpart.headline
          : null;

  // Day separators and "who in the team wrote" labels, worked out up front.
  const authorKeyOf = (message: ChatMessage) =>
    message.kind === "text" ? `${message.asCompany ? "c" : "p"}:${message.author?.userId ?? ""}` : "";
  const rows = messages.map((message, index) => {
    const previous = messages[index - 1];
    const showDay = !previous || messageDayKey(previous.createdAt) !== messageDayKey(message.createdAt);
    const showAuthor =
      message.kind === "text" &&
      view.kind === "company" &&
      message.asCompany &&
      !message.mine &&
      (showDay || !previous || authorKeyOf(previous) !== authorKeyOf(message));
    return { message, showDay, showAuthor };
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b app-border px-4 py-3">
        <LocalizedLink
          href={`${MESSAGES_PATH}${listQuery}`}
          aria-label={copy.thread.back}
          className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--surface-muted)] lg:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </LocalizedLink>
        <MessagingAvatar label={partner.title} imageUrl={partner.imageUrl} isCompany={partner.isCompany} />
        <div className="min-w-0 flex-1">
          {partner.href ? (
            <LocalizedLink
              href={partner.href}
              className="block truncate font-display text-base font-semibold text-[color:var(--foreground)] transition-colors hover:text-[color:var(--brand)]"
            >
              {partner.title}
            </LocalizedLink>
          ) : (
            <p className="truncate font-display text-base font-semibold text-[color:var(--foreground)]">{partner.title}</p>
          )}
          {subtitle ? <p className="truncate text-xs app-muted">{subtitle}</p> : null}
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          aria-label={copy.menu.label}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setMenuPosition({ top: rect.bottom + 8, right: Math.max(12, window.innerWidth - rect.right) });
            setMenuOpen((value) => !value);
          }}
          className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-[color:var(--surface-muted)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
        {menuOpen && menuPosition
          ? createPortal(
              <div
                id={menuId}
                role="menu"
                aria-label={copy.menu.label}
                style={{ position: "fixed", top: menuPosition.top, right: menuPosition.right }}
                className="z-50 w-56 rounded-2xl border app-border bg-[color:var(--surface)] p-1.5 shadow-2xl"
              >
                {menuItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    disabled={busy !== null}
                    onClick={item.onSelect}
                    className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)] disabled:cursor-wait"
                  >
                    {item.label}
                  </button>
                ))}
              </div>,
              document.body,
            )
          : null}
      </header>

      {view.applications.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b app-border px-4 py-2 text-xs">
          <span className="app-soft">{copy.thread.applications}:</span>
          {view.applications.map((application) => (
            <LocalizedLink
              key={application.applicationId}
              href={
                view.side === "company"
                  ? `/my-space/vacancies/${application.vacancyId}#application-${application.applicationId}`
                  : "/my-space/applications"
              }
              className="rounded-full border app-border px-2.5 py-1 text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)]"
            >
              {application.vacancyTitle}
              <span className="ml-1 app-soft">
                · {(statusLabels as Record<string, string>)[application.status] ?? application.status}
              </span>
            </LocalizedLink>
          ))}
        </div>
      ) : null}

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {hasOlder ? (
          <div className="mb-4 text-center">
            <Button variant="ghost" size="sm" disabled={loadingOlder} onClick={() => void loadOlder()}>
              {loadingOlder ? copy.loading : copy.thread.loadOlder}
            </Button>
          </div>
        ) : null}

        <ol role="log" aria-live="polite" aria-label={copy.thread.live} className="space-y-1">
          {rows.map(({ message, showDay, showAuthor }) => {
            if (message.kind === "event") {
              return (
                <li key={message.id}>
                  {showDay ? <DaySeparator label={formatMessageDay(message.createdAt, locale, copy)} /> : null}
                  <p className="my-3 text-center text-xs app-soft">{describeMessageEvent(message.event, message.eventData, copy)}</p>
                </li>
              );
            }

            const authorName = personLabel(message.author, copy.deletedAccount);
            const onDark = message.fromMySide;
            const bubble = onDark
              ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
              : "bg-[color:var(--surface-muted)] text-[color:var(--foreground)]";

            return (
              <li key={message.id}>
                {showDay ? <DaySeparator label={formatMessageDay(message.createdAt, locale, copy)} /> : null}
                <div className={`flex flex-col ${message.fromMySide ? "items-end" : "items-start"}`}>
                  {showAuthor ? (
                    <p className="mt-2 mb-1 px-1 text-xs app-soft">
                      {view.side === "company"
                        ? authorName
                        : copy.thread.fromCompany.replace("{name}", authorName).replace("{company}", view.company?.name ?? "")}
                    </p>
                  ) : null}
                  {message.scamFlag ? (
                    <p
                      role="note"
                      className="mb-1 max-w-[min(32rem,85%)] rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-[color:var(--foreground)]"
                    >
                      {copy.thread.scamWarning}
                    </p>
                  ) : null}
                  <div className={`max-w-[min(32rem,85%)] rounded-2xl px-3.5 py-2 ${bubble}`}>
                    {message.removed ? (
                      <p className="text-sm italic opacity-70">{copy.thread.removed}</p>
                    ) : message.body === null ? (
                      <p className="text-sm italic opacity-70">{copy.thread.held}</p>
                    ) : (
                      <MessageText text={message.body} onDark={onDark} />
                    )}
                    {message.held && message.mine && message.body !== null ? (
                      <p className="mt-1 text-xs opacity-70">{copy.thread.heldOwn}</p>
                    ) : null}
                  </div>
                  <p className="mt-0.5 mb-1.5 flex flex-wrap items-center gap-x-2 px-1 text-[11px] app-soft">
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt, locale)}</time>
                    {message.editedAt ? <span>{copy.thread.edited}</span> : null}
                    {message.id === readOwnId ? <span>{copy.thread.read}</span> : null}
                  </p>
                </div>
              </li>
            );
          })}

          {pending.map((item) => (
            <li key={item.clientId} className="flex flex-col items-end">
              <div className="max-w-[min(32rem,85%)] rounded-2xl bg-[color:var(--foreground)] px-3.5 py-2 text-[color:var(--background)] opacity-70">
                <MessageText text={item.body} onDark />
              </div>
              <p className="mt-0.5 mb-1.5 px-1 text-[11px] app-soft" role={item.status === "failed" ? "alert" : undefined}>
                {item.status === "sending" ? (
                  copy.thread.sending
                ) : (
                  <>
                    <span className="text-rose-600 dark:text-rose-400">{item.error ?? copy.thread.failed}</span>{" "}
                    <button
                      type="button"
                      onClick={() => retry(item)}
                      className="cursor-pointer font-medium text-[color:var(--foreground)] underline underline-offset-2"
                    >
                      {copy.thread.retry}
                    </button>
                  </>
                )}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {view.requestToMe ? (
        <div className="border-t app-border bg-[color:var(--surface-muted)] px-4 py-3">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {copy.request.toMeTitle.replace("{name}", partner.title)}
          </p>
          <p className="mt-1 text-xs leading-5 app-muted">{copy.request.toMeText}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy !== null} onClick={() => void act("accept")}>
              {copy.request.accept}
            </Button>
            <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setConfirm("clear")}>
              {copy.request.delete}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirm("block")}>
              {copy.request.block}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="border-t app-border p-3 sm:p-4">
        {cannotSend ? (
          <p className="text-sm leading-6 app-muted" role="status">
            {cannotSend}
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
            className="space-y-2"
          >
            {view.requestRules ? <p className="text-xs leading-5 app-muted">{copy.request.rulesHint}</p> : null}
            <div className="flex items-end gap-2">
              <label htmlFor={composerId} className="sr-only">
                {copy.composer.label}
              </label>
              <FormTextarea
                id={composerId}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={onComposerKeyDown}
                rows={1}
                maxAutoHeight={180}
                maxLength={MESSAGE_MAX_LENGTH + 200}
                placeholder={copy.composer.placeholder}
                aria-describedby={`${composerId}-hint`}
                aria-invalid={tooLong || undefined}
                className="min-h-[2.75rem] flex-1 resize-none bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm leading-6 text-[color:var(--foreground)]"
              />
              <Button type="submit" disabled={!trimmed || tooLong}>
                {copy.composer.send}
              </Button>
            </div>
            <p id={`${composerId}-hint`} className="hidden text-[11px] app-soft sm:block">
              {copy.composer.hintDesktop}
            </p>
            {linkWarning ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">{copy.composer.linkWarning}</p>
            ) : null}
            {tooLong ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">{copy.errors.too_long}</p>
            ) : trimmed.length > MESSAGE_MAX_LENGTH - 500 ? (
              <p className="text-xs app-soft">
                {copy.composer.counter.replace("{count}", String(trimmed.length)).replace("{max}", String(MESSAGE_MAX_LENGTH))}
              </p>
            ) : null}
          </form>
        )}
      </div>

      <ConfirmDialog
        open={confirm === "clear"}
        title={copy.confirm.clearTitle}
        description={copy.confirm.clearText}
        confirmLabel={copy.confirm.clearConfirm}
        cancelLabel={copy.confirm.cancel}
        pending={busy === "clear"}
        pendingLabel={copy.confirm.working}
        onConfirm={() => void act("clear")}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "block"}
        title={copy.confirm.blockTitle.replace("{name}", partner.title)}
        description={copy.confirm.blockText}
        confirmLabel={copy.confirm.blockConfirm}
        cancelLabel={copy.confirm.cancel}
        pending={busy === "block"}
        pendingLabel={copy.confirm.working}
        onConfirm={() => void act("block", true)}
        onCancel={() => setConfirm(null)}
      />
      <ContentReportButton
        copy={moderationCopy}
        targetType="conversation"
        targetId={conversationId}
        isAuthenticated={isAuthenticated}
        open={reporting}
        onClose={() => setReporting(false)}
      />
    </div>
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <p className="my-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-eyebrow app-soft" aria-hidden="true">
      <span className="h-px flex-1 bg-[color:var(--border)]" />
      {label}
      <span className="h-px flex-1 bg-[color:var(--border)]" />
    </p>
  );
}
