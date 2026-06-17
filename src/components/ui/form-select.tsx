"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type SelectOption = {
  label: string;
  value: string;
};

type FormSelectProps = {
  options: SelectOption[];
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  name?: string;
  emptyLabel?: string;
  noResultsLabel?: string;
  disabled?: boolean;
  /** Show a filter input at the top of the dropdown. */
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function FormSelect({
  options,
  value,
  onChange,
  placeholder,
  name,
  emptyLabel = "No options available",
  noResultsLabel,
  disabled = false,
  searchable = false,
  searchPlaceholder,
  className,
  triggerClassName,
  dropdownClassName,
}: FormSelectProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const [query, setQuery] = useState("");
  const listboxId = useId();

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const currentValue = onChange ? value : internalValue;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === currentValue) ?? null,
    [currentValue, options],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions =
    searchable && normalizedQuery
      ? options.filter((option) =>
          option.label.toLowerCase().includes(normalizedQuery),
        )
      : options;

  // The placeholder ("clear") row stays pinned and is not affected by the
  // text filter, so the user can always reset the selection.
  const visibleOptions =
    placeholder !== undefined
      ? [{ label: placeholder, value: "" }, ...filteredOptions]
      : filteredOptions;

  const resolvedEmptyLabel = noResultsLabel || emptyLabel;

  return (
    <div ref={wrapperRef} className={cx("relative", className)}>
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        data-open={isOpen}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => {
              if (current) setQuery("");
              return !current;
            });
          }
        }}
        className={cx("app-select-trigger", triggerClassName)}
      >
        <span className={selectedOption ? "" : "app-muted"}>
          {selectedOption?.label || placeholder || emptyLabel}
        </span>

        <svg
          className="app-select-chevron"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M7 10L12 15L17 10"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen ? (
        <div className={cx("app-select-dropdown", dropdownClassName)}>
          {searchable ? (
            <div className="border-b app-border p-2">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder || placeholder || ""}
                aria-label={searchPlaceholder || placeholder || "Search"}
                className="w-full rounded-xl border app-border bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus-visible:border-[color:var(--ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--border)]"
                autoFocus
              />
            </div>
          ) : null}
          <div
            id={listboxId}
            role="listbox"
            className="app-select-dropdown-inner"
          >
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => {
                const isSelected = option.value === currentValue;
                const isPlaceholderOption = option.value === "";

                return (
                  <button
                    key={`${option.value || "__empty__"}-${option.label}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    data-placeholder={isPlaceholderOption}
                    className="app-select-option"
                    onClick={() => {
                      setInternalValue(option.value);
                      onChange?.(option.value);
                      setIsOpen(false);
                      setQuery("");
                    }}
                  >
                    <span>{option.label}</span>
                    <span className="app-select-check" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M3.5 8.5L6.5 11.5L12.5 4.5"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="app-select-empty">{resolvedEmptyLabel}</p>
            )}
            {searchable &&
            normalizedQuery &&
            filteredOptions.length === 0 &&
            placeholder !== undefined ? (
              <p className="app-select-empty">{resolvedEmptyLabel}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
