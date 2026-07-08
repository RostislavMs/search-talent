"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { useDictionary } from "@/lib/i18n/client";

export type PickedGif = {
  url: string;
  width: number;
  height: number;
  title: string;
};

type GifSearchResult = PickedGif & { id: string; previewUrl: string };

type GifPickerProps = {
  /** Server-derived flag (provider key present). When false the button is hidden. */
  enabled: boolean;
  onSelect: (gif: PickedGif) => void;
  disabled?: boolean;
};

const SEARCH_DEBOUNCE_MS = 350;
// How many GIFs to request per page. Giphy caps a single request at 50; we
// paginate with `offset` and keep loading more as the user scrolls.
const PAGE_SIZE = 30;

// Quick-browse categories. An empty query maps to trending. Search terms are
// kept in English (Giphy indexes best in English); labels are localized.
const CATEGORIES = [
  { key: "trending", emoji: "🔥", query: "" },
  { key: "lol", emoji: "😂", query: "lol" },
  { key: "love", emoji: "❤️", query: "love" },
  { key: "wow", emoji: "😮", query: "wow" },
  { key: "sad", emoji: "😢", query: "sad" },
  { key: "applause", emoji: "👏", query: "applause" },
  { key: "yes", emoji: "👍", query: "yes" },
  { key: "no", emoji: "👎", query: "no" },
] as const;

export default function GifPicker({
  enabled,
  onSelect,
  disabled = false,
}: GifPickerProps) {
  const dictionary = useDictionary();
  const dict = dictionary.commentGif;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close on outside click / Escape (same pattern as ReactionPicker).
  useEffect(() => {
    if (!open) return;

    function handlePointer(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const fetchGifs = useCallback(
    async (q: string, offset: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const append = offset > 0;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));

      const result = await apiFetch<{ gifs?: GifSearchResult[] }>(
        `/api/gif/search?${params.toString()}`,
        { signal: controller.signal },
      );

      if (controller.signal.aborted) return;

      if (!result.ok) {
        if (!append) setGifs([]);
        setError(result.error || dict.loadError);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const batch = result.data.gifs || [];
      setGifs((prev) => (append ? [...prev, ...batch] : batch));
      // A short page means the provider has nothing more to give.
      setHasMore(batch.length >= PAGE_SIZE);
      setLoading(false);
      setLoadingMore(false);
    },
    [dict.loadError],
  );

  // Fetch the first page on open; debounce subsequent searches. A query change
  // starts a fresh page 0 and scrolls the results back to the top.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      setHasMore(true);
      scrollRef.current?.scrollTo({ top: 0 });
      void fetchGifs(query, 0);
    }, query.trim() ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(handle);
  }, [open, query, fetchGifs]);

  // Infinite scroll: load the next page when the sentinel enters the viewport.
  useEffect(() => {
    if (!open || !hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !loadingMore) {
          void fetchGifs(query, gifs.length);
        }
      },
      { root: scrollRef.current, rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, hasMore, loading, loadingMore, query, gifs.length, fetchGifs]);

  // Abort any in-flight request when the popover closes.
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  if (!enabled) return null;

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={dict.addGif}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border app-border app-panel px-3 text-xs font-semibold text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.7"
          />
          <path
            d="M9.5 9.5H8a1.5 1.5 0 0 0-1.5 1.5v2A1.5 1.5 0 0 0 8 14.5h1.5V12M12.5 9.5v5M15.5 9.5h2m-2 0v5m0-2.5h1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        GIF
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 sm:hidden"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label={dict.addGif}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-t-2xl border-t app-border bg-[color:var(--surface)] shadow-xl sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:mb-2 sm:max-h-96 sm:w-80 sm:rounded-2xl sm:border"
          >
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[color:var(--border)] sm:hidden"
          />
          <div className="space-y-2 border-b app-border p-2">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={dict.searchPlaceholder}
              className="w-full rounded-lg border app-border bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:app-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
            />
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {CATEGORIES.map((category) => {
                const active = query.trim() === category.query;
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => setQuery(category.query)}
                    className={[
                      "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-[color:var(--accent-soft)] text-[color:var(--foreground)]"
                        : "app-soft hover:bg-[color:var(--surface-muted)]",
                    ].join(" ")}
                  >
                    <span aria-hidden="true">{category.emoji}</span>
                    {dict.categories[category.key]}
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading && gifs.length === 0 ? (
              <p className="py-6 text-center text-xs app-muted">
                {dict.searching}
              </p>
            ) : error && gifs.length === 0 ? (
              <p className="py-6 text-center text-xs text-rose-500" role="alert">
                {error}
              </p>
            ) : gifs.length === 0 ? (
              <p className="py-6 text-center text-xs app-muted">
                {dict.noResults}
              </p>
            ) : (
              <>
                <div className="columns-2 gap-2 [column-fill:_balance] sm:columns-3">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => {
                      onSelect({
                        url: gif.url,
                        width: gif.width,
                        height: gif.height,
                        title: gif.title,
                      });
                      setOpen(false);
                    }}
                    className="mb-2 block w-full cursor-pointer overflow-hidden rounded-lg border app-border transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]"
                    title={gif.title || undefined}
                  >
                    {/* Third-party animated GIF from the provider CDN: a plain
                        <img> keeps the animation and avoids per-host next.config
                        remotePatterns. CSP img-src already allows https:. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gif.previewUrl}
                      alt={gif.title || ""}
                      loading="lazy"
                      className="w-full"
                    />
                  </button>
                ))}
                </div>
                {loadingMore ? (
                  <p className="py-3 text-center text-xs app-muted">
                    {dict.searching}
                  </p>
                ) : null}
                <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
              </>
            )}
          </div>

          <div className="border-t app-border px-3 py-1.5 text-right text-[10px] uppercase tracking-wide app-muted">
            {dict.poweredBy}
          </div>
          </div>
        </>
      )}
    </div>
  );
}
