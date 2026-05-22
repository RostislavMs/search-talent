"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/api-client";
import {
  NOTIFICATIONS_PAGE_SIZE,
  type NotificationItem,
} from "@/lib/constants/notifications";
import LocalizedLink from "@/components/ui/localized-link";
import {
  buildNotificationHref,
  describeNotification,
} from "@/lib/notifications-presentation";
import { useDictionary } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";

type Props = {
  initialItems: NotificationItem[];
  locale: Locale;
  emptyLabel: string;
};

export default function NotificationsList({
  initialItems,
  locale,
  emptyLabel,
}: Props) {
  const dictionary = useDictionary();
  const dict = dictionary.notifications;
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(
    initialItems.length === NOTIFICATIONS_PAGE_SIZE
      ? initialItems[initialItems.length - 1].createdAt
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);

    const result = await apiFetch<{
      notifications: NotificationItem[];
      nextCursor: string | null;
    }>(`/api/notifications?limit=${NOTIFICATIONS_PAGE_SIZE}&before=${encodeURIComponent(cursor)}`);

    setLoading(false);

    if (!result.ok) {
      setError(result.error || dict.loadError);
      return;
    }

    setItems((current) => [...current, ...result.data.notifications]);
    setCursor(result.data.nextCursor);
  }, [cursor, dict.loadError, loading]);

  const deleteItem = useCallback(
    async (id: string) => {
      const previous = items;
      setItems((current) => current.filter((entry) => entry.id !== id));
      const result = await apiFetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
      if (!result.ok) {
        setItems(previous);
        setError(result.error || dict.deleteError);
      }
    },
    [items, dict.deleteError],
  );

  if (items.length === 0) {
    return (
      <p className="rounded-[1.5rem] app-panel-dashed p-6 text-center text-sm app-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-500"
        >
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {items.map((item) => {
          const href = buildNotificationHref(item, locale);
          const description = describeNotification(item, dict);
          const actorName =
            item.metadata.actorName ||
            item.metadata.actorUsername ||
            dict.someone;
          return (
            <li
              key={item.id}
              className={[
                "flex items-start gap-3 rounded-2xl border app-border bg-[color:var(--surface)] p-3",
                item.readAt ? "" : "ring-1 ring-[color:var(--accent)]/40",
              ].join(" ")}
            >
              <LocalizedLink
                href={href}
                className="flex min-w-0 flex-1 items-start gap-3"
              >
                <span className="relative inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full app-panel">
                  {item.metadata.actorAvatarUrl ? (
                    <Image
                      src={item.metadata.actorAvatarUrl}
                      alt={actorName}
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="m-auto text-xs font-semibold text-[color:var(--foreground)]">
                      {actorName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug text-[color:var(--foreground)]">
                    <strong className="font-semibold">{actorName}</strong>{" "}
                    {description}
                  </span>
                  {item.metadata.excerpt ? (
                    <span className="mt-0.5 line-clamp-2 block text-xs app-muted">
                      {item.metadata.excerpt}
                    </span>
                  ) : null}
                </span>
              </LocalizedLink>
              <button
                type="button"
                onClick={() => void deleteItem(item.id)}
                aria-label={dict.deleteOne}
                className="ml-2 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full app-soft transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M6 18L18 6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>

      {cursor ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="cursor-pointer rounded-full border app-border px-4 py-2 text-xs font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)] disabled:opacity-50"
          >
            {loading ? dict.loading : dict.loadMore}
          </button>
        </div>
      ) : null}
    </div>
  );
}
