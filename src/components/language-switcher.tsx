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
            aria-label={`${dictionary.language.switchLabel}: ${dictionary.language[item]}`}
          >
            {item.toUpperCase()}
          </a>
        );
      })}
    </div>
  );
}
