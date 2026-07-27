"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAnchoredDropdown } from "@/components/ui/use-anchored-dropdown";

type Option = {
  id: number;
  name: string;
};

export default function SearchSelect({
  options,
  value,
  placeholder,
  onChange,
}: {
  options: Option[];
  value?: number;
  placeholder: string;
  onChange: (value: number | null) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.id === value) || null;
  const dropdownStyle = useAnchoredDropdown(triggerRef, isOpen);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.name.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

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
        <span className={selectedOption ? "" : "app-muted"}>
          {selectedOption?.name || placeholder}
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
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
                setQuery("");
              }}
              data-selected={!selectedOption}
              data-placeholder="true"
              className="app-select-option"
            >
              <span>{placeholder}</span>
              <span className="app-select-check" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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

            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = option.id === value;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onChange(option.id);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    data-selected={isSelected}
                    className="app-select-option"
                  >
                    <span>{option.name}</span>
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
              <p className="app-select-empty">No results found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
