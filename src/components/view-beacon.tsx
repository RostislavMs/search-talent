"use client";

import { useEffect } from "react";
import {
  resolveBeaconReferrer,
  type ViewTargetType,
} from "@/lib/view-tracking";

function getNavigationUrl(): string | null {
  const [entry] = performance.getEntriesByType?.("navigation") ?? [];
  return entry?.name ?? null;
}

/**
 * Reports one page view for the product metrics; renders nothing.
 *
 * Runs for guests and signed-in visitors alike (the server drops the author's
 * own visits and bots, and counts each visitor once a day). It sets no cookie
 * and stores nothing in the browser, so it does not wait for analytics consent.
 * Separate from the public view counters, which vote-buttons and
 * article-interactions keep recording as before.
 */
export default function ViewBeacon({
  targetType,
  targetId,
}: {
  targetType: ViewTargetType;
  targetId: string;
}) {
  useEffect(() => {
    if (navigator.webdriver) {
      return;
    }

    const referrer = resolveBeaconReferrer({
      navigationUrl: getNavigationUrl(),
      currentUrl: window.location.href,
      documentReferrer: document.referrer,
    });

    // keepalive lets the request finish when the visitor leaves right away.
    void fetch("/api/metrics/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, referrer }),
      keepalive: true,
    }).catch(() => {});
  }, [targetType, targetId]);

  return null;
}
