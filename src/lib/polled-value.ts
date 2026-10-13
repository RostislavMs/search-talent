"use client";

import { useSyncExternalStore } from "react";

/**
 * A value the browser polls from the server, shared by every component that
 * shows it. The header renders the notification bell and the messages icon
 * twice — once for the desktop layout and once for the phone one — and each
 * copy used to run its own timer and send its own requests. With one store per
 * value there is one timer and at most one request in flight, however many
 * copies are mounted. Polling pauses while the tab is hidden.
 */
export type PolledValue<T> = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T | undefined;
  /** Asks the server now; a request already in flight is reused. */
  refresh: () => Promise<void>;
  /** Changes the value locally, e.g. after marking everything read. */
  update: (next: (current: T | undefined) => T) => void;
};

export function createPolledValue<T>(
  load: () => Promise<T | null>,
  intervalMs: number,
): PolledValue<T> {
  let value: T | undefined;
  let inflight: Promise<void> | null = null;
  let timer: number | undefined;
  // Bumped when the last copy unmounts, so an answer to a request sent before
  // that cannot land in the fresh state of whoever mounts next.
  let generation = 0;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const refresh = () => {
    if (!inflight) {
      const sentIn = generation;
      inflight = load()
        .then((next) => {
          if (sentIn === generation && next !== null) {
            value = next;
            emit();
          }
        })
        .finally(() => {
          if (sentIn === generation) inflight = null;
        });
    }
    return inflight;
  };

  const refreshIfVisible = () => {
    if (document.visibilityState === "visible") void refresh();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        timer = window.setInterval(refreshIfVisible, intervalMs);
        document.addEventListener("visibilitychange", refreshIfVisible);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          window.clearInterval(timer);
          document.removeEventListener("visibilitychange", refreshIfVisible);
          // Nobody shows it any more; whoever mounts next starts from fresh data.
          value = undefined;
          inflight = null;
          generation += 1;
        }
      };
    },
    getSnapshot: () => value,
    refresh,
    update(next) {
      value = next(value);
      emit();
    },
  };
}

const getServerSnapshot = () => undefined;

/** The current value, or undefined until the first answer arrives. */
export function usePolledValue<T>(store: PolledValue<T>): T | undefined {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);
}
