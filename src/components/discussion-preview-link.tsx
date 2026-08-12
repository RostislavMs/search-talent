"use client";

import { ButtonLink } from "@/components/ui/Button";
import { useDictionary } from "@/lib/i18n/client";

/**
 * Footer of a truncated comment thread: states how much is hidden and links to
 * the thread's own page. Rendered only once a thread crosses the promotion
 * threshold, so a quiet page never shows it.
 */
export default function DiscussionPreviewLink({
  href,
  shown,
  total,
}: {
  href: string;
  shown: number;
  total: number;
}) {
  const dictionary = useDictionary();
  // A promoted thread can still fit entirely inline (few top-level comments,
  // many replies). Nothing is hidden then, so claiming "showing 10 of 10" would
  // be noise — the permalink button alone is the whole point.
  const isTruncated = shown < total;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl app-panel-dashed p-5">
      {isTruncated ? (
        <p className="text-sm app-muted">
          {dictionary.discussions.previewNote
            .replace("{shown}", String(shown))
            .replace("{total}", String(total))}
        </p>
      ) : (
        <span />
      )}
      <ButtonLink href={href} variant="secondary" size="sm">
        {dictionary.discussions.openFull}
      </ButtonLink>
    </div>
  );
}
