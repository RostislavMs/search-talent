"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { switchLocalePathname, type Locale } from "@/lib/i18n/config";
import { useCurrentLocale, useDictionary } from "@/lib/i18n/client";

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useCurrentLocale();
  const dictionary = useDictionary();

  const buildTargetHref = (targetLocale: Locale) => {
    const search = searchParams.toString();
    const base = switchLocalePathname(pathname, targetLocale);

    return search ? `${base}?${search}` : base;
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1 lg:p-0.5">
      {(["uk", "en"] as const).map((item) => {
        const active = locale === item;

        return (
          <a
            key={item}
            href={buildTargetHref(item)}
            className={[
              "rounded-full px-3 py-2 text-xs font-medium transition-colors lg:px-2.5 lg:py-1",
              active
                ? "bg-[color:var(--foreground)] text-[color:var(--background)]"
                : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
            // The visible label is the bare code ("UK"/"EN"), so the
            // accessible name has to contain it verbatim — WCAG 2.5.3 Label in
            // Name, and it is what voice-control users actually say. Naming
            // only the language ("Мова: Українська") fails that check.
            aria-label={`${dictionary.language.switchLabel}: ${item.toUpperCase()} — ${dictionary.language[item]}`}
          >
            {item.toUpperCase()}
          </a>
        );
      })}
    </div>
  );
}
