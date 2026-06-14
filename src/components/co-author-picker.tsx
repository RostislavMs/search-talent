"use client";

import { useEffect, useRef, useState } from "react";
import OptimizedImage from "@/components/ui/optimized-image";
import { MAX_CO_AUTHORS } from "@/lib/co-authors";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale } from "@/lib/i18n/config";

export type CoAuthorOption = {
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
};

type CoAuthorPickerProps = {
  value: CoAuthorOption[];
  onChange: (next: CoAuthorOption[]) => void;
  locale: string;
  max?: number;
  /** User ids to hide from results (e.g. the creator). */
  excludeUserIds?: string[];
};

function optionLabel(option: CoAuthorOption): string {
  return option.name || option.username || "—";
}

/**
 * Search-and-chip picker for inviting co-authors at content creation. Backed by
 * the existing /api/mentions/suggest endpoint (prefix match on username/name).
 * Selection is capped at MAX_CO_AUTHORS; the server re-validates regardless.
 */
export default function CoAuthorPicker({
  value,
  onChange,
  locale,
  max = MAX_CO_AUTHORS,
  excludeUserIds = [],
}: CoAuthorPickerProps) {
  const dict = getDictionary(isLocale(locale) ? locale : "en").coAuthors;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CoAuthorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const atMax = value.length >= max;
  const selectedIds = new Set(value.map((item) => item.userId));
  const excluded = new Set(excludeUserIds);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/mentions/suggest?q=${encodeURIComponent(trimmed)}`,
        );
        const data = (await response.json()) as { suggestions?: CoAuthorOption[] };
        if (!cancelled) {
          setResults(data.suggestions ?? []);
          setOpen(true);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function addOption(option: CoAuthorOption) {
    if (atMax || selectedIds.has(option.userId)) return;
    onChange([...value, option]);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function removeOption(userId: string) {
    onChange(value.filter((item) => item.userId !== userId));
  }

  const visibleResults = results.filter(
    (item) => !selectedIds.has(item.userId) && !excluded.has(item.userId),
  );

  return (
    <div ref={containerRef} className="relative">
      {value.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {value.map((option) => (
            <li
              key={option.userId}
              className="inline-flex items-center gap-2 rounded-full app-panel py-1 pl-1 pr-2 text-sm"
            >
              <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[color:var(--surface-muted)] text-[10px] font-semibold text-[color:var(--foreground)]">
                {option.avatarUrl ? (
                  <OptimizedImage
                    src={option.avatarUrl}
                    alt={optionLabel(option)}
                    fill
                    sizes="24px"
                    className="object-cover"
                  />
                ) : (
                  <span>{optionLabel(option).slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <span className="font-medium text-[color:var(--foreground)]">
                {optionLabel(option)}
              </span>
              <button
                type="button"
                onClick={() => removeOption(option.userId)}
                aria-label={dict.remove}
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-base leading-none app-muted transition hover:text-[color:var(--foreground)]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text"
        value={query}
        disabled={atMax}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={
          atMax
            ? dict.limitReached.replace("{max}", String(max))
            : dict.searchPlaceholder
        }
        className="w-full rounded-2xl border app-border bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--foreground)] disabled:opacity-60"
      />

      <p className="mt-1.5 text-xs app-soft">
        {dict.pickerHint.replace("{max}", String(max))}
      </p>

      {open && (loading || visibleResults.length > 0) && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border app-border bg-[color:var(--surface)] py-1 shadow-xl">
          {loading && (
            <li className="px-4 py-2 text-sm app-muted">{dict.searching}</li>
          )}
          {!loading &&
            visibleResults.map((option) => (
              <li key={option.userId}>
                <button
                  type="button"
                  onClick={() => addOption(option)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-[color:var(--surface-muted)]"
                >
                  <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[color:var(--surface-muted)] text-xs font-semibold text-[color:var(--foreground)]">
                    {option.avatarUrl ? (
                      <OptimizedImage
                        src={option.avatarUrl}
                        alt={optionLabel(option)}
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    ) : (
                      <span>{optionLabel(option).slice(0, 1).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[color:var(--foreground)]">
                      {option.name || option.username}
                    </span>
                    {option.username && (
                      <span className="block truncate text-xs app-muted">
                        @{option.username}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
