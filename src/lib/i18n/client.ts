"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createLocalePath,
  getLocaleFromPathname,
  switchLocalePathname,
  type Locale,
} from "@/lib/i18n/config";

export function useCurrentLocale(): Locale {
  return getLocaleFromPathname(usePathname());
}

/** One dictionary namespace with both languages, from `@/lib/i18n/copy/*`. */
type NamespaceCopy = { readonly [L in Locale]: unknown };

type PickedDictionary<Parts extends Record<string, NamespaceCopy>> = {
  readonly [Name in keyof Parts]: Parts[Name][Locale];
};

// The same parts in the same locale resolve to the same object, as the whole
// dictionary used to: components keep `dictionary` in effect and memo deps.
const pickedByShape = new Map<string, Record<string, unknown>>();

/**
 * The given dictionary namespaces in one language, for client code outside a
 * component render. Pass each namespace module under its dictionary name:
 * `pickDictionary({ coAuthors: coAuthorsCopy }, locale).coAuthors.title`.
 */
export function pickDictionary<const Parts extends Record<string, NamespaceCopy>>(
  parts: Parts,
  locale: Locale,
): PickedDictionary<Parts> {
  const names = Object.keys(parts);
  const shape = `${locale}:${names.join(",")}`;
  const cached = pickedByShape.get(shape);

  if (cached && names.every((name) => cached[name] === parts[name][locale])) {
    return cached as PickedDictionary<Parts>;
  }

  const picked = Object.fromEntries(names.map((name) => [name, parts[name][locale]]));
  pickedByShape.set(shape, picked);
  return picked as PickedDictionary<Parts>;
}

/**
 * The dictionary namespaces a client component shows, in the page's language:
 * `const dictionary = useDictionary({ nav: navCopy, common: commonCopy })`.
 *
 * Only the namespaces passed in reach the browser bundle. Importing the whole
 * dictionary here used to ship every string of both languages (~100KB gzipped)
 * to every page.
 */
export function useDictionary<const Parts extends Record<string, NamespaceCopy>>(
  parts: Parts,
): PickedDictionary<Parts> {
  return pickDictionary(parts, useCurrentLocale());
}

export function useLocalizedHref(href: string, locale?: Locale) {
  const currentLocale = useCurrentLocale();

  return createLocalePath(locale ?? currentLocale, href);
}

export function useLocalizedRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);

  return {
    locale,
    pathname,
    push: (href: string) => router.push(createLocalePath(locale, href)),
    replace: (href: string) => router.replace(createLocalePath(locale, href)),
    refresh: () => router.refresh(),
    switchLocale: (targetLocale: Locale) =>
      router.push(switchLocalePathname(pathname, targetLocale)),
  };
}
