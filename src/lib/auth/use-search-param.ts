"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  // The auth screens never change their own query string, so there is nothing
  // to listen to; a full navigation re-mounts the page anyway.
  return () => {};
}

/**
 * Reads one query parameter on the client without `useSearchParams`, which
 * would force the statically rendered auth pages into a Suspense boundary.
 * The server snapshot is null, so the first client render matches the HTML.
 */
export function useSearchParam(name: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
}
