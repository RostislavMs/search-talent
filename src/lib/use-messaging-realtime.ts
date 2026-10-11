"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * What the database broadcasts about a conversation on the person's private
 * topic user:<id> (the messages migration): ids only, never text — the page
 * reads the message itself through the API, checked like any other read.
 */
export type MessagingRealtimeEvent =
  | { type: "message" | "message_updated"; conversationId: string; messageId: string }
  | { type: "read"; conversationId: string; userId: string | null }
  | { type: "conversation"; conversationId: string };

const EVENTS = ["message", "message_updated", "read", "conversation"] as const;

function toEvent(type: (typeof EVENTS)[number], payload: unknown): MessagingRealtimeEvent | null {
  const row = (payload ?? {}) as Record<string, unknown>;
  const conversationId = typeof row.conversation_id === "string" ? row.conversation_id : null;

  if (!conversationId) return null;

  if (type === "message" || type === "message_updated") {
    return typeof row.message_id === "string" ? { type, conversationId, messageId: row.message_id } : null;
  }

  if (type === "read") {
    return { type, conversationId, userId: typeof row.user_id === "string" ? row.user_id : null };
  }

  return { type, conversationId };
}

/**
 * Subscribes to the signed-in person's own message topic while the component
 * is mounted (only the messages pages: the header badge polls instead, so an
 * open tab elsewhere costs no connection). `live` is false until subscribed
 * and after a drop; `onReconnect` runs when the connection comes back, so the
 * page can fetch what it missed.
 */
export function useMessagingRealtime(
  userId: string | null,
  onEvent: (event: MessagingRealtimeEvent) => void,
  onReconnect?: () => void,
): { live: boolean } {
  const [live, setLive] = useState(false);
  const eventRef = useRef(onEvent);
  const reconnectRef = useRef(onReconnect);

  useEffect(() => {
    eventRef.current = onEvent;
    reconnectRef.current = onReconnect;
  });

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let wasLive = false;
    let supabase: ReturnType<typeof createClient> | null = null;

    try {
      supabase = createClient();
    } catch {
      // No Supabase settings (tests, misconfigured preview): the page polls.
      return;
    }

    const client = supabase;

    void (async () => {
      try {
        // Private channels are authorized with the person's own token.
        await client.realtime.setAuth();
      } catch {
        return;
      }

      if (cancelled) return;

      channel = client.channel(`user:${userId}`, { config: { private: true } });

      for (const type of EVENTS) {
        channel.on("broadcast", { event: type }, (message: { payload?: unknown }) => {
          const event = toEvent(type, message.payload);
          if (event) eventRef.current(event);
        });
      }

      channel.subscribe((status) => {
        if (cancelled) return;

        if (status === "SUBSCRIBED") {
          setLive(true);
          if (wasLive) reconnectRef.current?.();
          wasLive = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setLive(false);
        }
      });
    })();

    return () => {
      cancelled = true;
      setLive(false);
      if (channel) {
        void client.removeChannel(channel);
      }
    };
  }, [userId]);

  return { live };
}
