"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import MessagingAvatar from "@/components/messaging-avatar";
import { useMessagingEvents } from "@/components/messaging-realtime-provider";
import { Button } from "@/components/ui/Button";
import LocalizedLink from "@/components/ui/localized-link";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import { messagesCopy } from "@/lib/i18n/copy/messages";
import {
  buildConversationHref,
  buildConversationPath,
  buildMessagesQuery,
  conversationBoxes,
  conversationPartner,
  CONVERSATIONS_PAGE_SIZE,
  MESSAGE_SEARCH_MAX_LENGTH,
  MESSAGE_SEARCH_MIN_LENGTH,
  MESSAGES_PATH,
  normalizeSearchQuery,
  splitHighlight,
  type ConversationBox,
  type ConversationPreview,
  type MessageSearchResult,
} from "@/lib/messages";
import { describeLastMessage, formatConversationTime } from "@/lib/messages-presentation";

export type ConversationScope = { id: string | null; name: string; unread: number };

/** The answer to one search; anything else typed meanwhile is still loading. */
type SearchAnswer = { query: string; results: MessageSearchResult[]; failed: boolean };

/** Typing asks the server once per pause, not on every key. */
const SEARCH_DELAY_MS = 300;

/** Fresh first page first, then what was loaded further down and is older. */
function mergeFirstPage(current: ConversationPreview[], fresh: ConversationPreview[]): ConversationPreview[] {
  if (fresh.length < CONVERSATIONS_PAGE_SIZE) return fresh;

  const oldest = fresh[fresh.length - 1].lastMessageAt;
  const ids = new Set(fresh.map((item) => item.id));
  return [...fresh, ...current.filter((item) => !ids.has(item.id) && item.lastMessageAt < oldest)];
}

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitHighlight(text, query).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-sm bg-brand-soft px-0.5 text-brand-on-soft">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * The conversations: a search, the boxes (all, unread, requests, archive),
 * whose inbox (one's own or a company's), and the list itself. It refreshes
 * when the live connection says something changed, and every 30 s without
 * one. While a search is typed, its results take the list's place: the
 * conversations whose name matches, then the messages, each opening the
 * conversation at that message.
 */
export default function ConversationList({
  initialConversations,
  box,
  companyId,
  activeId = null,
  scopes,
  requestsCount,
  locale,
  initialQuery = null,
}: {
  initialConversations: ConversationPreview[];
  box: ConversationBox;
  companyId: string | null;
  activeId?: string | null;
  scopes: ConversationScope[];
  requestsCount: number;
  locale: string;
  /** ?q= — a search to show at once (coming back from one of its results). */
  initialQuery?: string | null;
}) {
  const copy = useDictionary({ messages: messagesCopy }).messages;
  const searchId = useId();
  const [items, setItems] = useState(initialConversations);
  const [hasMore, setHasMore] = useState(initialConversations.length >= CONVERSATIONS_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [answer, setAnswer] = useState<SearchAnswer | null>(null);
  const refreshTimer = useRef<number | null>(null);
  const searchRequest = useRef(0);

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

  // --- Search ----------------------------------------------------------------------

  const normalizedQuery = normalizeSearchQuery(query);
  const searching = normalizedQuery.length >= MESSAGE_SEARCH_MIN_LENGTH;
  const current = searching && answer?.query === normalizedQuery ? answer : null;

  useEffect(() => {
    if (!searching) return;
    const request = ++searchRequest.current;

    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ q: normalizedQuery });
      if (companyId) params.set("company", companyId);
      const result = await apiFetch<{ results: MessageSearchResult[] }>(`/api/messages/search?${params.toString()}`);
      // A newer search started meanwhile: this answer is stale.
      if (request !== searchRequest.current) return;
      setAnswer({
        query: normalizedQuery,
        results: result.ok ? (result.data.results ?? []) : [],
        failed: !result.ok,
      });
    }, SEARCH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [normalizedQuery, companyId, searching]);

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

  const listQuery = buildMessagesQuery(box, companyId);
  const resultQuery = buildMessagesQuery(box, companyId, searching ? normalizedQuery : null);
  const tabClass = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
        : "text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]"
    }`;

  const nameResults = current ? current.results.filter((result) => result.messageId === null) : [];
  const messageResults = current ? current.results.filter((result) => result.messageId !== null) : [];

  const renderResult = (result: MessageSearchResult) => {
    const partner = conversationPartner(
      result,
      result.kind === "company" && result.side === "person" ? copy.companyUnavailable : copy.deletedAccount,
    );
    const active = result.conversationId === activeId;
    const snippet = result.snippet ?? "";

    return (
      <li key={result.messageId ?? `conversation-${result.conversationId}`} className="border-b app-border last:border-b-0">
        <LocalizedLink
          href={buildConversationHref(result.conversationId, resultQuery, result.seq)}
          aria-current={active && result.messageId === null ? "page" : undefined}
          className={`flex gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--surface-muted)] ${active ? "bg-[color:var(--surface-muted)]" : ""}`}
        >
          <MessagingAvatar label={partner.title} imageUrl={partner.imageUrl} isCompany={partner.isCompany} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium text-[color:var(--foreground)]">
                {result.messageId === null ? <Highlighted text={partner.title} query={normalizedQuery} /> : partner.title}
              </span>
              <time dateTime={result.createdAt} className="shrink-0 text-[11px] app-soft">
                {formatConversationTime(result.createdAt, locale)}
              </time>
            </span>
            {result.messageId !== null ? (
              <span className="mt-0.5 line-clamp-2 text-sm app-muted">
                {result.fromMySide ? `${copy.search.youPrefix} ` : null}
                <Highlighted text={snippet} query={normalizedQuery} />
              </span>
            ) : null}
          </span>
        </LocalizedLink>
      </li>
    );
  };

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

        <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
          <label htmlFor={searchId} className="sr-only">
            {copy.search.label}
          </label>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 app-soft"
          >
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                setQuery("");
              }
            }}
            maxLength={MESSAGE_SEARCH_MAX_LENGTH}
            autoComplete="off"
            placeholder={copy.search.placeholder}
            className="w-full rounded-full border app-border bg-[color:var(--surface-muted)] py-2 pr-9 pl-9 text-sm text-[color:var(--foreground)] focus:ring-2 focus:ring-[color:var(--ring)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              aria-label={copy.search.clear}
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full app-soft transition-colors hover:bg-[color:var(--surface)] hover:text-[color:var(--foreground)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </form>

        {!searching && scopes.length > 1 ? (
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

        {!searching ? (
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
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {searching ? (
          <div aria-live="polite">
            {!current ? (
              <p className="p-6 text-sm app-muted">{copy.search.searching}</p>
            ) : current.failed ? (
              <p className="p-6 text-sm text-rose-600 dark:text-rose-400" role="alert">
                {copy.search.failed}
              </p>
            ) : current.results.length === 0 ? (
              <p className="p-6 text-sm app-muted">{copy.search.empty}</p>
            ) : (
              <>
                {nameResults.length > 0 ? (
                  <section aria-label={copy.search.conversations}>
                    <h2 className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-eyebrow app-soft">
                      {copy.search.conversations}
                    </h2>
                    <ul>{nameResults.map(renderResult)}</ul>
                  </section>
                ) : null}
                {messageResults.length > 0 ? (
                  <section aria-label={copy.search.messages}>
                    <h2 className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-eyebrow app-soft">
                      {copy.search.messages}
                    </h2>
                    <ul>{messageResults.map(renderResult)}</ul>
                  </section>
                ) : null}
              </>
            )}
          </div>
        ) : items.length === 0 ? (
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
                    href={`${buildConversationPath(item.id)}${listQuery}`}
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

        {!searching && hasMore && items.length > 0 ? (
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
