"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { buttonStyles, countBadge } from "@/components/ui/button-styles";
import LocalizedLink from "@/components/ui/localized-link";
import { apiFetch } from "@/lib/api-client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import {
  MESSAGES_PATH,
  MESSAGES_POLL_INTERVAL_MS,
  summaryBadgeCount,
  type MessagingSummary,
} from "@/lib/messages";
import { createPolledValue, usePolledValue } from "@/lib/polled-value";

// Shared by the desktop and phone copies of the icon: one poll for both.
const unreadCountStore = createPolledValue(async () => {
  const result = await apiFetch<{ summary: MessagingSummary }>("/api/messages/summary");
  return result.ok ? summaryBadgeCount(result.data.summary) : null;
}, MESSAGES_POLL_INTERVAL_MS);

/**
 * The "Messages" icon in the header, with what is new (requests included).
 * It polls like the notification bell, paused while the tab is hidden: a
 * live connection is opened only on the messages pages themselves.
 */
export type MessagesNavLinkCopy = Pick<
  Dictionary["messages"],
  "title" | "openLabel" | "unreadLabel"
>;

export default function MessagesNavLink({
  copy,
  initialCount = 0,
  className,
}: {
  /** From the header's props: the whole messages namespace is too big to ship. */
  copy: MessagesNavLinkCopy;
  initialCount?: number;
  className?: string;
}) {
  const pathname = usePathname();
  const count = usePolledValue(unreadCountStore) ?? initialCount;

  // Opening a conversation reads it: ask again on every route change.
  useEffect(() => {
    if (!pathname) return;
    const id = window.setTimeout(() => void unreadCountStore.refresh(), 1500);
    return () => window.clearTimeout(id);
  }, [pathname]);

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
          className={countBadge}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </LocalizedLink>
  );
}
