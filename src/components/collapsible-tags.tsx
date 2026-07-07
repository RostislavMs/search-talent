"use client";

import { useState } from "react";

type TagItem = { id: number | string; name: string };

/**
 * Renders a wrapping list of tag chips. When the list exceeds `initialCount`,
 * the extras collapse behind a "show all / show less" toggle so long skill
 * lists don't dominate the page (especially on mobile).
 */
export default function CollapsibleTags({
  items,
  initialCount = 12,
  showMoreLabel,
  showLessLabel,
}: {
  items: TagItem[];
  initialCount?: number;
  showMoreLabel: string;
  showLessLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > initialCount;
  const visible = expanded || !hasMore ? items : items.slice(0, initialCount);
  const hiddenCount = items.length - initialCount;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {visible.map((item) => (
          <span
            key={item.id}
            className="rounded-full border app-border px-3 py-1 text-sm text-[color:var(--foreground)]"
          >
            {item.name}
          </span>
        ))}
      </div>

      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-3 inline-flex cursor-pointer items-center gap-1 rounded-full border app-border px-3 py-1 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
        >
          {expanded ? showLessLabel : `${showMoreLabel} (${hiddenCount})`}
        </button>
      ) : null}
    </div>
  );
}
