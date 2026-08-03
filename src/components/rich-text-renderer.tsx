"use client";

import { useMemo, type CSSProperties } from "react";
import { useCurrentLocale } from "@/lib/i18n/client";
import {
  extractPlainTextFromRichText,
  linkifyMentionsInHtml,
  sanitizeRichTextHtml,
} from "@/lib/rich-text";

export { extractPlainTextFromRichText as stripRichTextFormatting } from "@/lib/rich-text";

export default function RichTextRenderer({
  content,
  accentColor,
  compact = false,
}: {
  content: string;
  accentColor: string;
  compact?: boolean;
}) {
  const locale = useCurrentLocale();
  const sanitizedHtml = useMemo(
    () =>
      // Sanitize first, always: the linkifier adds markup of its own, so it must
      // never run on untrusted input.
      linkifyMentionsInHtml(sanitizeRichTextHtml(content), `/${locale}/u/`),
    [content, locale],
  );
  const hasContent = useMemo(
    () => extractPlainTextFromRichText(sanitizedHtml).length > 0,
    [sanitizedHtml],
  );

  if (!hasContent) {
    return null;
  }

  return (
    <div
      // Internal links inside authored bodies (article content, poll
      // descriptions, profile bios) get hover preview cards. The scope marker
      // has to live here because the HTML is injected, so its anchors are not
      // React elements — see `components/link-preview-provider`.
      data-link-preview-scope=""
      className={[
        "rich-text-renderer",
        compact ? "space-y-4 text-sm leading-7" : "space-y-5 text-base leading-8",
        "text-[color:var(--muted-foreground)]",
      ].join(" ")}
      style={{ ["--rich-text-accent" as const]: accentColor } as CSSProperties}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
