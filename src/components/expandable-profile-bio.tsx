"use client";

import { useMemo, useState } from "react";
import RichTextRenderer, {
  stripRichTextFormatting,
} from "@/components/rich-text-renderer";

export default function ExpandableProfileBio({
  content,
  locale,
  accentColor,
  maxCharacters = 280,
}: {
  content: string;
  locale: string;
  accentColor: string;
  maxCharacters?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const plainText = useMemo(() => stripRichTextFormatting(content), [content]);
  const isCollapsible = plainText.length > maxCharacters;
  const previewText = isCollapsible
    ? `${plainText.slice(0, maxCharacters).trimEnd()}...`
    : plainText;
  const readMoreLabel = locale === "uk" ? "Читати далі" : "Read more";
  const showLessLabel = locale === "uk" ? "Згорнути" : "Show less";

  if (!expanded && isCollapsible) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-8 app-muted">{previewText}</p>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center rounded-full border app-border px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
          onClick={() => setExpanded(true)}
        >
          {readMoreLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RichTextRenderer content={content} accentColor={accentColor} compact />

      {isCollapsible ? (
        <button
          type="button"
          className="inline-flex cursor-pointer items-center rounded-full border app-border px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
          onClick={() => setExpanded(false)}
        >
          {showLessLabel}
        </button>
      ) : null}
    </div>
  );
}
