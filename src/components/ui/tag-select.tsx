"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAnchoredDropdown } from "@/components/ui/use-anchored-dropdown";

type Option = {
  id: number;
  name: string;
};

export default function TagSelect({
  options,
  value = [],
  placeholder,
  onChange,
}: {
  options: Option[];
  value?: number[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownStyle = useAnchoredDropdown(triggerRef, isOpen);
  const selectedValues = useMemo(() => new Set(value), [value]);
  const selectedOptions = options.filter((option) =>
    selectedValues.has(option.id),
  );
  const selectedSummary =
    selectedOptions.length > 0
      ? selectedOptions
          .slice(0, 2)
          .map((option) => option.name)
          .join(", ") +
        (selectedOptions.length > 2 ? ` +${selectedOptions.length - 2}` : "")
      : placeholder;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return options.filter((option) => {
      if (selectedValues.has(option.id)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return option.name.toLowerCase().includes(normalizedQuery);
    });
  }, [options, query, selectedValues]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-open={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="app-select-trigger"
      >
        <span className={selectedOptions.length > 0 ? "" : "app-muted"}>
          {selectedSummary}
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

      {selectedOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                onChange(value.filter((item) => item !== option.id).map(String))
              }
              className="rounded-full border app-border bg-[color:var(--surface)] px-3 py-1 text-sm app-muted transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
            >
              {option.name} ×
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="app-select-dropdown" style={dropdownStyle}>
          {/* Pinned above the list so filtering stays reachable while scrolling. */}
          <div className="app-select-dropdown-header">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border app-border bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus-visible:border-[color:var(--ring)] focus-visible:ring-2 focus-visible:ring-[color:var(--border)]"
              autoFocus
            />
          </div>

          <div className="app-select-dropdown-inner">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange([...value, option.id].map(String));
                    setQuery("");
                  }}
                  className="app-select-option"
                >
                  <span>{option.name}</span>
                  <span className="app-select-check" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 3V13M3 8H13"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </button>
              ))
            ) : (
              <p className="app-select-empty">No results found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
