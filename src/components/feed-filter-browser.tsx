"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import InfiniteCardFeed from "@/components/infinite-card-feed";
import FormSelect from "@/components/ui/form-select";
import { apiFetch } from "@/lib/api-client";
import type { ArticleFeedItem } from "@/lib/articles";
import type { PollFeedItem } from "@/lib/polls";

type FeedItem = ArticleFeedItem | PollFeedItem;

type FeedFilterUi = {
  filterCategory: string;
  filterAuthor: string;
  filterSort: string;
  authorPlaceholder: string;
  allCategories: string;
  recent: string;
  popular: string;
  discussed: string;
  apply: string;
  reset: string;
  empty: string;
  /**
   * Free-text keyword search. Optional: only feeds that pass both labels get a
   * search box (currently /articles). When omitted the field is not rendered
   * and no `search` param is ever sent, so /polls keeps its original filters.
   */
  filterSearch?: string;
  searchPlaceholder?: string;
};

type Props = {
  kind: "article" | "poll";
  locale: string;
  /**
   * Server-rendered default feed (no filters). Seeding from this keeps real
   * cards in the SSR HTML — filters only fetch on user action, never on mount,
   * so crawlers see the seeded listing and this component never triggers the
   * robots-blocked feed API for them. "Reset" restores this exact set.
   */
  initialItems: FeedItem[];
  /** Prebuilt category dropdown options (value = slug, label = display name). */
  categoryOptions: Array<{ value: string; label: string }>;
  ui: FeedFilterUi;
  /** Left intro column of the hero, rendered on the server. */
  children: ReactNode;
};

// Client-side listing filters for /articles and /polls. Filter state (category,
// author, sort) lives here rather than in the URL — matching the /talents &
// /projects discovery pages — so applying a filter fetches the feed API and
// swaps the cards in place, without pushing query params onto the address bar.
export default function FeedFilterBrowser({
  kind,
  locale,
  initialItems,
  categoryOptions,
  ui,
  children,
}: Props) {
  const endpoint = kind === "article" ? "/api/articles" : "/api/polls";

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [author, setAuthor] = useState("");
  const [sort, setSort] = useState("recent");
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Bumped on every result swap so the feed remounts and its progressive-reveal
  // count resets to the first batch instead of keeping the previous scroll depth.
  const [feedNonce, setFeedNonce] = useState(0);
  // Below lg the whole filter block collapses behind a "Filters" toggle so the
  // tall panel doesn't push the feed down on phones; from lg up it is always
  // shown (see the form's `lg:block`) and this state is ignored.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  // Guards against out-of-order responses: only the latest request applies.
  const requestIdRef = useRef(0);

  const errorText =
    locale === "uk"
      ? "Не вдалося завантажити результати. Спробуйте ще раз."
      : "Could not load results. Please try again.";
  const filtersLabel = locale === "uk" ? "Фільтри" : "Filters";

  const applyFilters = async (event: FormEvent) => {
    event.preventDefault();

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (category) params.set("category", category);
    if (author.trim()) params.set("author", author.trim());
    if (sort && sort !== "recent") params.set("sort", sort);
    params.set("locale", locale);

    const result = await apiFetch<{ items: FeedItem[] }>(
      `${endpoint}?${params.toString()}`,
    );

    if (requestId !== requestIdRef.current) {
      return;
    }

    setLoading(false);

    if (!result.ok) {
      setErrorMessage(result.error || errorText);
      return;
    }

    setItems(result.data.items || []);
    setFeedNonce((current) => current + 1);
  };

  const resetFilters = () => {
    // Invalidate any in-flight request and restore the SSR seed instantly —
    // no network round-trip needed to get back to the default listing.
    requestIdRef.current += 1;
    setSearch("");
    setCategory("");
    setAuthor("");
    setSort("recent");
    setErrorMessage(null);
    setLoading(false);
    setItems(initialItems);
    setFeedNonce((current) => current + 1);
  };

  return (
    <>
      <section className="relative rounded-none sm:rounded-hero app-card">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          {children}

          {/* Minimal mobile toggle. It sits on the card surface (not inside the
              gradient panel), so the collapsed state is a slim pill instead of a
              full hero card — much lighter on phones. Hidden from lg up, where
              the panel is always shown. */}
          <div className="px-4 sm:px-8 lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-full border app-border bg-[color:var(--surface)] px-4 py-2.5 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-[color:var(--surface-muted)]"
            >
              <span className="flex items-center gap-2">
                <svg
                  aria-hidden="true"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 5h18M6 12h12M10 19h4" />
                </svg>
                {filtersLabel}
              </span>
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className={`transition-transform duration-200 ${
                  filtersOpen ? "rotate-180" : ""
                }`}
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div
            id={filtersId}
            className={`bg-brand-hero rounded-panel border app-border p-6 text-white shadow-[0_22px_70px_rgba(15,23,42,0.18)] sm:p-8 lg:-my-px lg:-mr-px lg:block lg:rounded-l-panel lg:rounded-r-hero ${
              filtersOpen ? "block" : "hidden"
            }`}
          >
            <form className="space-y-4" onSubmit={applyFilters}>
              {ui.filterSearch ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/78">
                    {ui.filterSearch}
                  </label>
                  <div className="relative">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={ui.searchPlaceholder}
                      className="w-full rounded-2xl border border-white/12 bg-white/96 py-3 pl-9 pr-3 text-slate-900 placeholder:text-slate-500"
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-medium text-white/78">
                  {ui.filterAuthor}
                </label>
                <input
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  placeholder={ui.authorPlaceholder}
                  className="w-full rounded-2xl border border-white/12 bg-white/96 p-3 text-slate-900 placeholder:text-slate-500"
                />
              </div>

              {/* Category + sort share a row from sm up — two compact selects
                  instead of two full-width stacked fields. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/78">
                    {ui.filterCategory}
                  </label>
                  <FormSelect
                    value={category}
                    onChange={setCategory}
                    placeholder={ui.allCategories}
                    className="w-full"
                    triggerClassName="w-full border-white/12 bg-white/96 text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
                    dropdownClassName="bg-white text-slate-900"
                    options={categoryOptions}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/78">
                    {ui.filterSort}
                  </label>
                  <FormSelect
                    value={sort}
                    onChange={setSort}
                    className="w-full"
                    triggerClassName="w-full border-white/12 bg-white/96 text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
                    dropdownClassName="bg-white text-slate-900"
                    options={[
                      { value: "recent", label: ui.recent },
                      { value: "popular", label: ui.popular },
                      { value: "discussed", label: ui.discussed },
                    ]}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 shadow-sm transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {ui.apply}
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-full border border-white/16 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/16 sm:w-auto"
                >
                  {ui.reset}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="mt-8">
        {errorMessage && (
          <p className="mb-4 rounded-none sm:rounded-panel border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            {errorMessage}
          </p>
        )}

        {items.length > 0 ? (
          <div
            aria-busy={loading}
            className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}
          >
            {kind === "article" ? (
              <InfiniteCardFeed
                key={feedNonce}
                kind="article"
                items={items as ArticleFeedItem[]}
                locale={locale}
              />
            ) : (
              <InfiniteCardFeed
                key={feedNonce}
                kind="poll"
                items={items as PollFeedItem[]}
                locale={locale}
              />
            )}
          </div>
        ) : (
          <p className="rounded-none sm:rounded-panel app-panel-dashed p-6 text-sm app-muted">
            {ui.empty}
          </p>
        )}
      </section>
    </>
  );
}
