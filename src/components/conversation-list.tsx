"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MessagingAvatar from "@/components/messaging-avatar";
import { useMessagingEvents } from "@/components/messaging-realtime-provider";
import { Button } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import {
  buildConversationPath,
  buildMessagesQuery,
  conversationBoxes,
  conversationPartner,
  CONVERSATIONS_PAGE_SIZE,
  MESSAGES_PATH,
  type ConversationBox,
  type ConversationPreview,
} from "@/lib/messages";
import { describeLastMessage, formatConversationTime } from "@/lib/messages-presentation";

export type ConversationScope = { id: string | null; name: string; unread: number };

/** Fresh first page first, then what was loaded further down and is older. */
function mergeFirstPage(current: ConversationPreview[], fresh: ConversationPreview[]): ConversationPreview[] {
  if (fresh.length < CONVERSATIONS_PAGE_SIZE) return fresh;

  const oldest = fresh[fresh.length - 1].lastMessageAt;
  const ids = new Set(fresh.map((item) => item.id));
  return [...fresh, ...current.filter((item) => !ids.has(item.id) && item.lastMessageAt < oldest)];
}

/**
 * The conversations: the boxes (all, unread, requests, archive), whose inbox
 * (one's own or a company's), and the list itself. It refreshes when the live
 * connection says something changed, and every 30 s without one.
 */
export default function ConversationList({
  initialConversations,
  box,
  companyId,
  activeId = null,
  scopes,
  requestsCount,
  locale,
}: {
  initialConversations: ConversationPreview[];
  box: ConversationBox;
  companyId: string | null;
  activeId?: string | null;
  scopes: ConversationScope[];
  requestsCount: number;
  locale: string;
}) {
  const copy = useDictionary().messages;
  const [items, setItems] = useState(initialConversations);
  const [hasMore, setHasMore] = useState(initialConversations.length >= CONVERSATIONS_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const refreshTimer = useRef<number | null>(null);

  const listUrl = useCallback(
    (before?: string) => {
      const params = new URLSearchParams({ box });
      if (companyId) params.set("company", companyId);
      if (before) params.set("before", before);
      return `/api/messages/conversations?${params.toString()}`;
    },
    [box, companyId],
  );

  const refresh = useCallback(async () => {
    const result = await apiFetch<{ conversations: ConversationPreview[] }>(listUrl());
    if (result.ok) {
      setItems((current) => mergeFirstPage(current, result.data.conversations));
    }
  }, [listUrl]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      void refresh();
    }, 300);
  }, [refresh]);

  const { live } = useMessagingEvents((event) => {
    if (event.type === "message" || event.type === "conversation" || event.type === "reconnect" || event.type === "read") {
      scheduleRefresh();
    }
  });

  // Without a live connection, ask now and then while the tab is visible.
  useEffect(() => {
    if (live) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [live, refresh]);

  useEffect(
    () => () => {
      if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    },
    [],
  );

  async function loadMore() {
    const last = items[items.length - 1];
    if (!last) return;

    setLoadingMore(true);
    setLoadFailed(false);
    const result = await apiFetch<{ conversations: ConversationPreview[] }>(listUrl(last.lastMessageAt));
    setLoadingMore(false);

    if (!result.ok) {
      setLoadFailed(true);
      return;
    }

    const ids = new Set(items.map((item) => item.id));
    setItems([...items, ...result.data.conversations.filter((item) => !ids.has(item.id))]);
    setHasMore(result.data.conversations.length >= CONVERSATIONS_PAGE_SIZE);
  }

  const query = buildMessagesQuery(box, companyId);
  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
        : "text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b app-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-xl font-semibold tracking-tight text-[color:var(--foreground)]">{copy.title}</h1>
          <LocalizedLink
            href="/messages/settings"
            className="rounded-full px-3 py-1.5 text-sm font-medium app-soft transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
          >
            {copy.settings}
          </LocalizedLink>
        </div>

        {scopes.length > 1 ? (
          <nav aria-label={copy.scopeLabel} className="flex gap-1.5 overflow-x-auto pb-0.5">
            {scopes.map((scope) => {
              const active = scope.id === companyId;
              return (
                <LocalizedLink
                  key={scope.id ?? "personal"}
                  href={`${MESSAGES_PATH}${buildMessagesQuery("inbox", scope.id)}`}
                  aria-current={active ? "page" : undefined}
                  className={`${tabClass(active)} border app-border`}
                >
                  {scope.name}
                  {scope.unread > 0 ? <span className="ml-1.5 opacity-70">{scope.unread}</span> : null}
                </LocalizedLink>
              );
            })}
          </nav>
        ) : null}

        <nav aria-label={copy.title} className="flex gap-1 overflow-x-auto pb-0.5">
          {conversationBoxes
            // A company's team never receives requests: it is always the one asking.
            .filter((item) => !(item === "requests" && companyId))
            .map((item) => {
              const active = item === box;
              return (
                <LocalizedLink
                  key={item}
                  href={`${MESSAGES_PATH}${buildMessagesQuery(item, companyId)}`}
                  aria-current={active ? "page" : undefined}
                  className={tabClass(active)}
                >
                  {copy.boxes[item]}
                  {item === "requests" && requestsCount > 0 ? (
                    <span className="ml-1.5 opacity-70">{requestsCount}</span>
                  ) : null}
                </LocalizedLink>
              );
            })}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="p-6 text-sm leading-6 app-muted">{companyId && box === "inbox" ? copy.emptyCompany : copy.empty[box]}</p>
        ) : (
          <ul>
            {items.map((item) => {
              const partner = conversationPartner(item, item.kind === "company" && item.side === "person" ? copy.companyUnavailable : copy.deletedAccount);
              const active = item.id === activeId;
              const unread = item.unreadCount > 0;
              const preview = describeLastMessage(item.lastMessage, copy);

              return (
                <li key={item.id} className="border-b app-border last:border-b-0">
                  <LocalizedLink
                    href={`${buildConversationPath(item.id)}${query}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--surface-muted)] ${
                      active ? "bg-[color:var(--surface-muted)]" : ""
                    }`}
                  >
                    <MessagingAvatar label={partner.title} imageUrl={partner.imageUrl} isCompany={partner.isCompany} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm text-[color:var(--foreground)] ${unread ? "font-semibold" : "font-medium"}`}
                        >
                          {partner.title}
                        </span>
                        <time dateTime={item.lastMessageAt} className="shrink-0 text-[11px] app-soft">
                          {formatConversationTime(item.lastMessageAt, locale)}
                        </time>
                      </span>
                      <span className={`mt-0.5 block truncate text-sm ${unread ? "text-[color:var(--foreground)]" : "app-muted"}`}>
                        {preview}
                      </span>
                      {item.requestToMe || item.awaitingReply || item.muted || unread ? (
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                          {item.requestToMe ? (
                            <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-0.5 text-[color:var(--foreground)]">
                              {copy.requestBadge}
                            </span>
                          ) : null}
                          {item.awaitingReply ? <span className="app-soft">{copy.waitingReply}</span> : null}
                          {item.muted ? <span className="app-soft">{copy.mutedBadge}</span> : null}
                          {unread ? (
                            <span className="rounded-full bg-[color:var(--brand)] px-2 py-0.5 text-[color:var(--brand-foreground)]">
                              {copy.unreadCount.replace("{count}", String(item.unreadCount))}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </LocalizedLink>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && items.length > 0 ? (
          <div className="p-4">
            <Button variant="secondary" size="sm" className="w-full" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? copy.loading : copy.loadMore}
            </Button>
            {loadFailed ? (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400" role="alert">
                {copy.loadFailed}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
