"use client";

import { Fragment } from "react";
import LocalizedLink from "@/components/ui/localized-link";
import { MENTION_REGEX } from "@/lib/constants/mentions";

type MentionTextProps = {
  body: string;
  /** Optional CSS class applied to the wrapping <span>. */
  className?: string;
};

type Segment =
  | { kind: "text"; value: string }
  | { kind: "mention"; username: string };

function tokenize(body: string): Segment[] {
  if (!body) return [];

  const segments: Segment[] = [];
  let lastIndex = 0;

  // Reset the lastIndex of the shared regex because it is `g`-flagged.
  MENTION_REGEX.lastIndex = 0;

  for (const match of body.matchAll(MENTION_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: "text", value: body.slice(lastIndex, start) });
    }
    segments.push({ kind: "mention", username: match[1] });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({ kind: "text", value: body.slice(lastIndex) });
  }

  return segments;
}

/**
 * Renders a plain-text body and turns `@username` tokens into links to
 * the corresponding public profile. Preserves whitespace/newlines via
 * `whitespace-pre-line` on the caller's container; we never inject any
 * HTML to keep XSS surface zero.
 */
export default function MentionText({ body, className }: MentionTextProps) {
  const segments = tokenize(body);

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <Fragment key={index}>{segment.value}</Fragment>
        ) : (
          <LocalizedLink
            key={index}
            href={`/u/${segment.username}`}
            className="font-semibold text-[color:var(--accent)] hover:underline"
          >
            @{segment.username}
          </LocalizedLink>
        ),
      )}
    </span>
  );
}
