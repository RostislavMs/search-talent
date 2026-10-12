"use client";

import { useEffect, useMemo, useState } from "react";
import LinkPreviewCard from "@/components/link-preview-card";
import LocalizedLink from "@/components/ui/localized-link";
import { useCurrentLocale } from "@/lib/i18n/client";
import { stripLocaleFromPathname } from "@/lib/i18n/config";
import { linkPreviewCacheKey, parseLinkPreviewHref, type LinkPreview } from "@/lib/link-preview";
import { getCachedLinkPreview, loadLinkPreview } from "@/lib/link-preview-client";
import { messageLinkTargets } from "@/lib/messages";

/**
 * One card for a link to this site's page. Nothing shows until the card has
 * loaded, and nothing at all for a page with no public card (a draft, a
 * hidden profile): the link in the text is there either way.
 */
function MessageLinkCard({ path }: { path: string }) {
  const locale = useCurrentLocale();
  const target = parseLinkPreviewHref(path);
  const cacheKey = target ? linkPreviewCacheKey(target, locale) : null;
  const [preview, setPreview] = useState<LinkPreview | null | undefined>(() =>
    cacheKey ? getCachedLinkPreview(cacheKey) : null,
  );

  useEffect(() => {
    if (!cacheKey || preview !== undefined) return;
    let current = true;
    void loadLinkPreview(path, locale, cacheKey).then((value) => {
      if (current) setPreview(value);
    });
    return () => {
      current = false;
    };
  }, [cacheKey, locale, path, preview]);

  if (!preview) return null;

  return (
    <LocalizedLink
      href={path}
      className="group mt-1.5 block w-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <LinkPreviewCard preview={preview} variant="inline" />
    </LocalizedLink>
  );
}

/**
 * Cards under a message for its links to profiles, projects, articles, polls,
 * vacancies and companies on this site (at most two). The cards open in the
 * reader's language, whichever one the link was copied in.
 */
export default function MessageLinkCards({ text }: { text: string }) {
  const paths = useMemo(
    () => Array.from(new Set(messageLinkTargets(text).map((path) => stripLocaleFromPathname(path)))),
    [text],
  );

  if (paths.length === 0) return null;

  return (
    <div className="flex w-full max-w-[min(24rem,85%)] flex-col">
      {paths.map((path) => (
        <MessageLinkCard key={path} path={path} />
      ))}
    </div>
  );
}
