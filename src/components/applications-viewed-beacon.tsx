"use client";

import { useEffect, useRef } from "react";

/**
 * Tells the server which new applications the team has now seen, once the
 * list is actually on screen (a prefetch or a render alone does not count).
 * The status stays "new" on the page until the next visit, so the team can
 * still tell what came in since last time.
 */
export default function ApplicationsViewedBeacon({ ids }: { ids: string[] }) {
  const sent = useRef(false);
  const key = ids.join(",");

  useEffect(() => {
    if (sent.current || !key) return;
    sent.current = true;

    void fetch("/api/applications/viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: key.split(",") }),
      keepalive: true,
    }).catch(() => undefined);
  }, [key]);

  return null;
}
