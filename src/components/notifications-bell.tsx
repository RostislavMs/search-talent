"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { apiFetch } from "@/lib/api-client";
import {
  NOTIFICATIONS_POLL_INTERVAL_MS,
  type NotificationItem,
} from "@/lib/constants/notifications";
import { buttonStyles } from "@/components/ui/button-styles";
import LocalizedLink from "@/components/ui/localized-link";
import { useDictionary, useLocalizedRouter } from "@/lib/i18n/client";
import {
  buildNotificationHref,
  describeNotification,
} from "@/lib/notifications-presentation";

const PREVIEW_LIMIT = 6;

type NotificationsBellProps = {
  /**
   * `dropdown` (default, desktop): clicking the bell opens an in-place
   * preview list. `link` (mobile): clicking navigates straight to the
   * full /notifications page. The link variant skips polling for the
   * preview but still polls the unread count for the badge.
   */
  mode?: "dropdown" | "link";
  /** Extra classes for the outer wrapper (e.g. responsive visibility). */
  className?: string;
};

export default function NotificationsBell({
  mode = "dropdown",
  className,
}: NotificationsBellProps = {}) {
  const dictionary = useDictionary();
  const dict = dictionary.notifications;
  const router = useLocalizedRouter();
  const locale = router.locale;

  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  const refreshUnread = useCallback(async () => {
    const result = await apiFetch<{ count: number }>(
      "/api/notifications/unread-count",
    );
    if (result.ok) setUnreadCount(result.data.count);
  }, []);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    const result = await apiFetch<{ notifications: NotificationItem[] }>(
      `/api/notifications?limit=${PREVIEW_LIMIT}`,
    );
    setLoading(false);
    if (result.ok) {
      setItems(result.data.notifications);
    }
  }, []);

  // When the viewer lands on the /notifications page, the server-side
  // page handler marks every notification as read. Mirror that on the
  // client so the badge drops to 0 immediately — no need to wait for
  // the next poll cycle (up to 45 s).
  useEffect(() => {
    if (!pathname) return;
    if (!/\/notifications(?:\/|$|\?)/.test(pathname)) return;
    queueMicrotask(() => {
      setUnreadCount(0);
      setItems((current) =>
        current.map((entry) =>
          entry.readAt
            ? entry
            : { ...entry, readAt: new Date().toISOString() },
        ),
      );
    });
  }, [pathname]);

  // Initial fetch + polling. Pauses when the tab is hidden to save tokens.
  useEffect(() => {
    // Defer the first fetch off the effect tick to avoid the
    // `set-state-in-effect` lint rule (still runs on mount).
    queueMicrotask(() => {
      void refreshUnread();
    });

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void refreshUnread();
    };

    const intervalId = window.setInterval(
      tick,
      NOTIFICATIONS_POLL_INTERVAL_MS,
    );
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshUnread();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshUnread]);

  // Close dropdown on outside click / ESC.
  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        if (containerRef.current) containerRef.current.open = false;
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (containerRef.current) containerRef.current.open = false;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    const next = event.currentTarget.open;
    setOpen(next);
    // Always re-fetch on open so the preview matches the badge count.
    // Caching across opens leads to a stale empty list when new
    // notifications arrived since the dropdown was first shown.
    if (next) void loadPreview();
  };

  const markAllRead = async () => {
    const result = await apiFetch("/api/notifications/mark-read", {
      method: "POST",
      body: { all: true },
    });
    if (!result.ok) return;
    setUnreadCount(0);
    setItems((current) =>
      current.map((entry) =>
        entry.readAt ? entry : { ...entry, readAt: new Date().toISOString() },
      ),
    );
  };

  /**
   * Clicking a notification in the dropdown navigates the user to the
   * target. We optimistically mark just that one as read so the badge
   * decrements without waiting for the next poll. The server call is
   * fire-and-forget; if it fails the next poll will reconcile.
   */
  const handleItemClick = (item: NotificationItem) => {
    if (item.readAt) return;
    setUnreadCount((current) => Math.max(0, current - 1));
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, readAt: new Date().toISOString() }
          : entry,
      ),
    );
    void apiFetch("/api/notifications/mark-read", {
      method: "POST",
      body: { ids: [item.id] },
    });
  };

  const bellIcon = (
    <>
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 8a6 6 0 1 1 12 0v4l1.5 3h-15L6 12V8Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M10 18a2 2 0 0 0 4 0"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      {unreadCount > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </>
  );

  // ---------------------------------------------------------------- link mode
  // On small screens the dropdown is too cramped; tapping the bell
  // navigates straight to /notifications. We still poll for the badge
  // count so the unread number stays fresh.
  if (mode === "link") {
    return (
      <LocalizedLink
        href="/notifications"
        aria-label={dict.openLabel}
        className={`${buttonStyles({
          size: "sm",
          variant: "secondary",
          className:
            "relative h-11 w-11 cursor-pointer p-0 justify-center",
        })} ${className ?? ""}`}
      >
        {bellIcon}
      </LocalizedLink>
    );
  }

  // ---------------------------------------------------------------- dropdown
  return (
    <details
      ref={containerRef}
      onToggle={handleToggle}
      className={`relative ${className ?? ""}`}
    >
      <summary
        className={`${buttonStyles({
          size: "sm",
          variant: "secondary",
          className:
            "relative h-11 w-11 cursor-pointer list-none p-0 justify-center [&::-webkit-details-marker]:hidden",
        })}`}
        aria-label={dict.openLabel}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 8a6 6 0 1 1 12 0v4l1.5 3h-15L6 12V8Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M10 18a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </summary>

      <div className="absolute right-0 z-40 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-[1.75rem] border app-border bg-[color:var(--surface)] p-3 shadow-2xl">
        <div className="flex items-center justify-between px-1 pb-2">
          <h2 className="text-sm font-semibold text-[color:var(--foreground)]">
            {dict.title}
          </h2>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="cursor-pointer rounded-full px-2 py-1 text-xs font-medium app-soft transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
            >
              {dict.markAllRead}
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="px-3 py-6 text-center text-xs app-muted">
            {dict.loading}
          </p>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs app-muted">
            {dict.empty}
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => {
              const href = buildNotificationHref(item, locale);
              const description = describeNotification(item, dict);
              const actorName =
                item.metadata.actorName ||
                item.metadata.actorUsername ||
                dict.someone;
              return (
                <li key={item.id}>
                  <LocalizedLink
                    href={href}
                    onClick={() => handleItemClick(item)}
                    className={[
                      "flex items-start gap-2 rounded-2xl px-2.5 py-2 transition-colors hover:bg-[color:var(--surface-muted)]",
                      item.readAt ? "" : "bg-[color:var(--surface-muted)]/60",
                    ].join(" ")}
                  >
                    <span className="relative inline-flex h-8 w-8 shrink-0 overflow-hidden rounded-full app-panel">
                      {item.metadata.actorAvatarUrl ? (
                        <Image
                          src={item.metadata.actorAvatarUrl}
                          alt={actorName}
                          fill
                          sizes="32px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="m-auto text-xs font-semibold text-[color:var(--foreground)]">
                          {actorName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-snug text-[color:var(--foreground)]">
                        <strong className="font-semibold">{actorName}</strong>{" "}
                        {description}
                      </span>
                      {item.metadata.excerpt ? (
                        <span className="mt-0.5 line-clamp-1 block text-[11px] app-muted">
                          {item.metadata.excerpt}
                        </span>
                      ) : null}
                    </span>
                    {!item.readAt ? (
                      <span
                        aria-hidden="true"
                        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[color:var(--accent)]"
                      />
                    ) : null}
                  </LocalizedLink>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2 border-t app-border pt-2 text-center">
          <LocalizedLink
            href="/notifications"
            className="inline-block cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)]"
          >
            {dict.openAll}
          </LocalizedLink>
        </div>
      </div>
    </details>
  );
}
