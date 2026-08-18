"use client";

import { useEffect, useRef, useState } from "react";
import ArticleCard from "@/components/article-card";
import PollCard from "@/components/poll-card";
import MasonryGrid from "@/components/ui/masonry-grid";
import type { ArticleFeedItem } from "@/lib/articles";
import type { PollFeedItem } from "@/lib/polls";

// Progressive reveal for the article/poll listing grids. The server already
// computes the whole (capped) feed and passes it in; this component renders the
// first `initialCount` cards on the server — so the SSR HTML holds real cards,
// not skeletons, and Google never sees a Soft 404 — then reveals `batchSize`
// more each time a bottom sentinel scrolls into view. No network round-trip:
// the data is already present, so reveals are instant.
type CommonProps = {
  locale: string;
  /** Cards rendered on first paint (also the server-rendered count). */
  initialCount?: number;
  /** Extra cards revealed each time the sentinel scrolls into view. */
  batchSize?: number;
};

type Props = CommonProps &
  (
    | {
        kind: "article";
        items: ArticleFeedItem[];
        section?: "articles" | "news";
      }
    | { kind: "poll"; items: PollFeedItem[] }
  );

export default function InfiniteCardFeed(props: Props) {
  const { locale, initialCount = 9, batchSize = 6 } = props;
  const total = props.items.length;
  const [visible, setVisible] = useState(() => Math.min(initialCount, total));
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = visible < total;

  // Recreate the observer on each reveal so that, if the sentinel is still in
  // view after a batch appears, its initial-observe callback fires again and
  // keeps filling until the sentinel is pushed off-screen (or the feed runs
  // out). The 400px margin starts loading just before the sentinel is reached.
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible((current) => Math.min(total, current + batchSize));
        }
      },
      { rootMargin: "400px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, total, batchSize, visible]);

  const loadingLabel = locale === "uk" ? "Завантаження…" : "Loading…";

  return (
    <>
      {/* Articles go into a masonry grid: covers are optional, so stretching
          every card to the tallest in its row leaves a void under the text-only
          ones. Polls are uniform (no media), so a plain grid still reads right
          there. */}
      {props.kind === "article" ? (
        <MasonryGrid className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {props.items.slice(0, visible).map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              locale={locale}
              section={props.section}
              // The first cover is the LCP element on the listing pages. Lazy by
              // default, it was discovered only after hydration — 2.6s of pure
              // load delay. Everything below the first card stays lazy.
              priority={index === 0}
            />
          ))}
        </MasonryGrid>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {props.items.slice(0, visible).map((poll) => (
            <PollCard key={poll.id} poll={poll} locale={locale} />
          ))}
        </div>
      )}

      {hasMore ? (
        <div
          ref={sentinelRef}
          role="status"
          aria-label={loadingLabel}
          className="flex justify-center py-8"
        >
          <span
            aria-hidden="true"
            className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--surface-muted)] border-t-[color:var(--foreground)]"
          />
        </div>
      ) : null}
    </>
  );
}
