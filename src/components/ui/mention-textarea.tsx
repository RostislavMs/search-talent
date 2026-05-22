"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type TextareaHTMLAttributes,
} from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/api-client";
import { MENTION_TRIGGER_REGEX } from "@/lib/constants/mentions";
import { useDictionary } from "@/lib/i18n/client";

type Suggestion = {
  userId: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
};

type MentionTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  /**
   * Optional render slot for a custom dropdown anchor; if omitted, the
   * dropdown is anchored to the textarea's bottom-left corner.
   */
};

const DEBOUNCE_MS = 180;
const MAX_VISIBLE = 8;

/**
 * Textarea with `@username` autocomplete. The dropdown queries
 * `/api/mentions/suggest` while the user types after an `@`. Selecting
 * a suggestion replaces the active token with `@<username> `.
 *
 * Pure controlled component: parent owns the value. No `alert()`,
 * `prompt()`, or browser dialogs (per platform rules).
 */
const MentionTextarea = forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  function MentionTextarea(props, externalRef) {
    const { value, onChange, className, ...textareaProps } = props;

    const dictionary = useDictionary();
    const dict = dictionary.mentions;

    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(
      externalRef,
      () => innerRef.current as HTMLTextAreaElement,
    );

    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const tokenRangeRef = useRef<{ start: number; end: number } | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => () => abortRef.current?.abort(), []);

    const closeDropdown = () => {
      setOpen(false);
      setSuggestions([]);
      setActiveIndex(0);
      tokenRangeRef.current = null;
    };

    const fetchSuggestions = (query: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      void apiFetch<{ suggestions: Suggestion[] }>(
        `/api/mentions/suggest?q=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      ).then((result) => {
        if (controller.signal.aborted) return;
        setLoading(false);
        if (!result.ok) {
          setSuggestions([]);
          return;
        }
        const list = result.data.suggestions.slice(0, MAX_VISIBLE);
        setSuggestions(list);
        setActiveIndex(0);
        setOpen(list.length > 0);
      });
    };

    const debounceTimer = useRef<number | null>(null);
    const debounceFetch = (query: string) => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = window.setTimeout(
        () => fetchSuggestions(query),
        DEBOUNCE_MS,
      );
    };

    const detectTrigger = (text: string, caretPos: number) => {
      const prefix = text.slice(0, caretPos);
      const match = MENTION_TRIGGER_REGEX.exec(prefix);
      if (!match) {
        closeDropdown();
        return;
      }
      const query = match[1];
      const tokenStart = caretPos - match[0].length + match[0].indexOf("@");
      tokenRangeRef.current = { start: tokenStart, end: caretPos };
      if (query.length === 0) {
        setOpen(false);
        setSuggestions([]);
        return;
      }
      debounceFetch(query);
    };

    const insertMention = (suggestion: Suggestion) => {
      const range = tokenRangeRef.current;
      if (!range) {
        closeDropdown();
        return;
      }
      const before = value.slice(0, range.start);
      const after = value.slice(range.end);
      const insertion = `@${suggestion.username} `;
      const nextValue = `${before}${insertion}${after}`;
      const nextCaret = before.length + insertion.length;

      onChange(nextValue);
      closeDropdown();

      window.requestAnimationFrame(() => {
        const el = innerRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
      });
    };

    const handleChange = (
      event: React.ChangeEvent<HTMLTextAreaElement>,
    ) => {
      const next = event.target.value;
      onChange(next);
      const caret = event.target.selectionStart ?? next.length;
      detectTrigger(next, caret);
    };

    const handleKeyDown = (
      event: React.KeyboardEvent<HTMLTextAreaElement>,
    ) => {
      if (!open || suggestions.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        );
      } else if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertMention(suggestions[activeIndex]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeDropdown();
      }
    };

    return (
      <div className="relative">
        <textarea
          ref={innerRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Defer closing so suggestion clicks still register.
            window.setTimeout(closeDropdown, 120);
          }}
          className={className}
          {...textareaProps}
        />

        {open && (
          <div
            role="listbox"
            aria-label={dict.suggestionsLabel}
            className="absolute left-0 top-full z-30 mt-2 max-h-72 w-full max-w-sm overflow-auto rounded-2xl border app-border bg-[color:var(--surface)] p-1.5 shadow-2xl"
          >
            {loading && suggestions.length === 0 ? (
              <p className="px-3 py-2 text-xs app-muted">{dict.loading}</p>
            ) : null}
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.userId}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => {
                  // mousedown beats blur to keep the dropdown open.
                  event.preventDefault();
                  insertMention(suggestion);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={[
                  "flex w-full cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
                  index === activeIndex
                    ? "bg-[color:var(--surface-muted)]"
                    : "hover:bg-[color:var(--surface-muted)]",
                ].join(" ")}
              >
                <span className="relative inline-flex h-7 w-7 shrink-0 overflow-hidden rounded-full app-panel">
                  {suggestion.avatarUrl ? (
                    <Image
                      src={suggestion.avatarUrl}
                      alt={suggestion.name || suggestion.username}
                      fill
                      sizes="28px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="m-auto text-xs font-semibold text-[color:var(--foreground)]">
                      {(suggestion.name ||
                        suggestion.username)[0]?.toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[color:var(--foreground)]">
                    {suggestion.name || suggestion.username}
                  </span>
                  <span className="block truncate text-xs app-muted">
                    @{suggestion.username}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);

export default MentionTextarea;
