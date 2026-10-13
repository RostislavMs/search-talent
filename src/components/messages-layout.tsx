import type { ReactNode } from "react";
import MessagingRealtimeProvider from "@/components/messaging-realtime-provider";

/**
 * The messages screen, edge to edge under the header: the list on the left
 * and the conversation on the rest of the width; on a phone one of the two at
 * a time (the list, or the open conversation). The footer steps aside here
 * (SiteFooterSlot), so the screen is exactly the window's height. One live
 * connection for both halves.
 */
export default function MessagesLayout({
  userId,
  list,
  thread,
  threadOpen,
}: {
  userId: string;
  list: ReactNode;
  thread: ReactNode;
  threadOpen: boolean;
}) {
  return (
    <main className="w-full">
      <MessagingRealtimeProvider userId={userId}>
        {/* grid-cols-1 is minmax(0, 1fr): an implicit `auto` column would grow to the widest
            unwrapped line (a long headline) and push the screen past a phone's width. */}
        <div className="grid h-[calc(100dvh-var(--site-header-height,4.3rem))] min-h-[24rem] grid-cols-1 overflow-hidden bg-[color:var(--surface)] lg:grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)]">
          <aside className={`${threadOpen ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 flex-col app-border lg:border-r`}>
            {list}
          </aside>
          <section className={`${threadOpen ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col`}>{thread}</section>
        </div>
      </MessagingRealtimeProvider>
    </main>
  );
}
