"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/button-styles";
import LocalizedLink from "@/components/ui/localized-link";
import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";
import {
  MESSAGES_PATH,
  MESSAGES_POLL_INTERVAL_MS,
  summaryBadgeCount,
  type MessagingSummary,
} from "@/lib/messages";

/**
 * The "Messages" icon in the header, with what is new (requests included).
 * It polls like the notification bell, paused while the tab is hidden: a
 * live connection is opened only on the messages pages themselves.
 */
export default function MessagesNavLink({
  initialCount = 0,
  className,
}: {
  initialCount?: number;
  className?: string;
}) {
  const copy = useDictionary().messages;
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);

  const refresh = useCallback(async () => {
    const result = await apiFetch<{ summary: MessagingSummary }>("/api/messages/summary");
    if (result.ok) setCount(summaryBadgeCount(result.data.summary));
  }, []);

  // Opening a conversation reads it: ask again on every route change.
  useEffect(() => {
    if (!pathname) return;
    const id = window.setTimeout(() => void refresh(), 1500);
    return () => window.clearTimeout(id);
  }, [pathname, refresh]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, MESSAGES_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const label = count > 0 ? copy.unreadLabel.replace("{count}", String(count)) : copy.openLabel;

  return (
    <LocalizedLink
      href={MESSAGES_PATH}
      aria-label={label}
      title={copy.title}
      className={`${buttonStyles({
        size: "sm",
        variant: "secondary",
        className: "relative h-11 w-11 cursor-pointer p-0 justify-center",
      })} ${className ?? ""}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16H10l-4.2 3.4a.5.5 0 0 1-.8-.4V16.1A2.5 2.5 0 0 1 4.5 13.5v-7Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-semibold text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </LocalizedLink>
  );
}
