"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useMessagingRealtime, type MessagingRealtimeEvent } from "@/lib/use-messaging-realtime";

type Listener = (event: MessagingRealtimeEvent | { type: "reconnect" }) => void;

type MessagingRealtimeContextValue = {
  live: boolean;
  subscribe: (listener: Listener) => () => void;
};

const MessagingRealtimeContext = createContext<MessagingRealtimeContextValue>({
  live: false,
  subscribe: () => () => undefined,
});

/**
 * One live connection for the whole messages page: the list and the open
 * conversation both listen to it. Only the messages pages mount it.
 */
export default function MessagingRealtimeProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const listeners = useRef(new Set<Listener>());

  const dispatch = useCallback((event: MessagingRealtimeEvent | { type: "reconnect" }) => {
    for (const listener of listeners.current) {
      listener(event);
    }
  }, []);

  const { live } = useMessagingRealtime(userId, dispatch, () => dispatch({ type: "reconnect" }));

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ live, subscribe }), [live, subscribe]);

  return <MessagingRealtimeContext.Provider value={value}>{children}</MessagingRealtimeContext.Provider>;
}

/** Listens to the page's live events; `live` says whether the connection is up. */
export function useMessagingEvents(listener: Listener): { live: boolean } {
  const { live, subscribe } = useContext(MessagingRealtimeContext);
  const listenerRef = useRef(listener);

  useEffect(() => {
    listenerRef.current = listener;
  });

  useEffect(() => subscribe((event) => listenerRef.current(event)), [subscribe]);

  return { live };
}
