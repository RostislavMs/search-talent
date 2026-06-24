"use client";

import { useCallback, useMemo, useState } from "react";
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
  getNotificationCategory,
  resolveActorName,
  resolveNotificationEmoji,
  type NotificationCategory,
} from "@/lib/notifications-presentation";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { useDictionary } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";

type Props = {
  initialItems: NotificationItem[];
  locale: Locale;
  emptyLabel: string;
};

type DateBucket = "today" | "yesterday" | "thisWeek" | "earlier";

const BUCKET_ORDER: DateBucket[] = [
  "today",
  "yesterday",
  "thisWeek",
  "earlier",
];

// Fixed display order for the filter chips so the bar never reshuffles as
// more pages load. Only categories present in the loaded set are rendered.
const CATEGORY_ORDER: NotificationCategory[] = [
  "mentions",
  "reactions",
  "follows",
  "content",
  "coAuthors",
  "moderation",
  "badges",
];

const DAY_MS = 86_400_000;

function bucketForDate(iso: string): DateBucket {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const start = startOfToday.getTime();
  const t = new Date(iso).getTime();
  if (t >= start) return "today";
  if (t >= start - DAY_MS) return "yesterday";
  if (t >= start - 6 * DAY_MS) return "thisWeek";
  return "earlier";
}

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
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");

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

  // Which category chips to show — derived from the loaded set so users only
  // see filters that actually have something behind them.
  const availableCategories = useMemo(() => {
    const present = new Set(items.map((item) => getNotificationCategory(item)));
    return CATEGORY_ORDER.filter((category) => present.has(category));
  }, [items]);

  // If the active filter's category vanished (e.g. its last item was
  // deleted), fall back to "all" without leaving a dangling selection.
  const effectiveFilter =
    filter !== "all" && !availableCategories.includes(filter) ? "all" : filter;

  const visibleItems = useMemo(
    () =>
      effectiveFilter === "all"
        ? items
        : items.filter(
            (item) => getNotificationCategory(item) === effectiveFilter,
          ),
    [items, effectiveFilter],
  );

  // Bucket the (already date-descending) items into ordered date groups.
  const groups = useMemo(() => {
    const map = new Map<DateBucket, NotificationItem[]>();
    for (const item of visibleItems) {
      const bucket = bucketForDate(item.createdAt);
      const list = map.get(bucket);
      if (list) list.push(item);
      else map.set(bucket, [item]);
    }
    return BUCKET_ORDER.flatMap((bucket) => {
      const list = map.get(bucket);
      return list && list.length > 0 ? [{ bucket, items: list }] : [];
    });
  }, [visibleItems]);

  if (items.length === 0) {
    return (
      <p className="rounded-3xl app-panel-dashed p-6 text-center text-sm app-muted">
        {emptyLabel}
      </p>
    );
  }

  const chips: Array<NotificationCategory | "all"> = [
    "all",
    ...availableCategories,
  ];

  return (
    <div className="space-y-4">
      {/* Show the filter bar only when there's more than one kind to sift. */}
      {availableCategories.length > 1 ? (
        <div
          role="group"
          aria-label={dict.filterLabel}
          className="flex flex-wrap gap-2"
        >
          {chips.map((chip) => {
            const active = chip === effectiveFilter;
            const label =
              chip === "all" ? dict.filters.all : dict.filters[chip];
            return (
              <button
                key={chip}
                type="button"
                onClick={() => setFilter(chip)}
                aria-pressed={active}
                className={[
                  "cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                    : "border app-border bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-500"
        >
          {error}
        </p>
      ) : null}

      {visibleItems.length === 0 ? (
        <p className="rounded-3xl app-panel-dashed p-6 text-center text-sm app-muted">
          {dict.emptyFiltered}
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map(({ bucket, items: groupItems }) => (
            <section key={bucket} className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-eyebrow app-soft">
                {dict.groups[bucket]}
              </h2>
              <ul className="space-y-2">
                {groupItems.map((item) => {
                  const href = buildNotificationHref(item, locale);
                  const description = describeNotification(item, dict);
                  const actorName = resolveActorName(item, dict);
                  const fallbackEmoji = resolveNotificationEmoji(item);
                  return (
                    <li
                      key={item.id}
                      className={[
                        "flex items-start gap-3 rounded-2xl border app-border bg-[color:var(--surface)] p-3",
                        item.readAt
                          ? ""
                          : "ring-1 ring-[color:var(--accent)]/40",
                      ].join(" ")}
                    >
                      <LocalizedLink
                        href={href}
                        className="flex min-w-0 flex-1 items-start gap-3"
                      >
                        <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full app-panel">
                          {item.metadata.actorAvatarUrl ? (
                            <Image
                              src={item.metadata.actorAvatarUrl}
                              alt={actorName}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : fallbackEmoji ? (
                            <span className="text-lg" aria-hidden="true">
                              {fallbackEmoji}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-[color:var(--foreground)]">
                              {actorName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug text-[color:var(--foreground)]">
                            <strong className="font-semibold">
                              {actorName}
                            </strong>{" "}
                            {description}
                          </span>
                          {item.metadata.excerpt ? (
                            <span className="mt-0.5 line-clamp-2 block text-xs app-muted">
                              {item.metadata.excerpt}
                            </span>
                          ) : null}
                          <span
                            suppressHydrationWarning
                            className="mt-1 block text-xs app-soft"
                          >
                            {formatRelativeTime(item.createdAt, locale)}
                          </span>
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
            </section>
          ))}
        </div>
      )}

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
