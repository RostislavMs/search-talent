import Link from "next/link";
import type { ReactNode } from "react";

// Shared component used in two modes:
//   • client pages pass `onPageChange` → interactive <button> controls;
//   • server pages pass `hrefFor` → <Link> controls with real URLs.
// Both render the identical style: ‹ arrow, 1 2 3, ellipsis gaps, and the
// first + last page always visible. No "use client" directive so it works in
// server trees; when a client page imports it, it is bundled client-side.
type PaginationBaseProps = {
  currentPage: number;
  totalPages: number;
  ariaLabel?: string;
};

type PaginationProps = PaginationBaseProps &
  (
    | { onPageChange: (page: number) => void; hrefFor?: undefined }
    | { hrefFor: (page: number) => string; onPageChange?: undefined }
  );

// First + last + a window around the current page, with ellipsis gaps:
// 1 … 4 5 6 … 20
function buildPages(
  current: number,
  total: number,
): Array<number | "ellipsis"> {
  const wanted = new Set<number>([
    1,
    total,
    current - 1,
    current,
    current + 1,
  ]);
  const sorted = [...wanted]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  const result: Array<number | "ellipsis"> = [];
  let previous = 0;

  for (const page of sorted) {
    if (previous && page - previous > 1) {
      result.push("ellipsis");
    }
    result.push(page);
    previous = page;
  }

  return result;
}

const arrowBase =
  "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors";
const arrowEnabled =
  "text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]";
const arrowDisabled = "app-muted opacity-40";
const pageBase =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm transition-colors";

const PrevIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M15 6l-6 6 6 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const NextIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M9 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  hrefFor,
  ariaLabel = "Pagination",
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = buildPages(currentPage, totalPages);

  const renderArrow = (
    targetPage: number,
    label: string,
    icon: ReactNode,
    disabled: boolean,
  ) => {
    if (disabled) {
      return (
        <span
          aria-hidden="true"
          className={`${arrowBase} ${arrowDisabled}`}
        >
          {icon}
        </span>
      );
    }

    if (hrefFor) {
      return (
        <Link
          href={hrefFor(targetPage)}
          aria-label={label}
          className={`${arrowBase} ${arrowEnabled}`}
        >
          {icon}
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onPageChange?.(targetPage)}
        aria-label={label}
        className={`cursor-pointer ${arrowBase} ${arrowEnabled}`}
      >
        {icon}
      </button>
    );
  };

  const renderPage = (page: number) => {
    const isCurrent = page === currentPage;
    const className = [
      pageBase,
      isCurrent
        ? "bg-[color:var(--surface-muted)] font-semibold text-[color:var(--foreground)]"
        : "text-[color:var(--foreground)] hover:bg-[color:var(--surface-muted)]",
    ].join(" ");

    if (isCurrent) {
      return (
        <span key={page} aria-current="page" className={className}>
          {page}
        </span>
      );
    }

    if (hrefFor) {
      return (
        <Link key={page} href={hrefFor(page)} className={className}>
          {page}
        </Link>
      );
    }

    return (
      <button
        key={page}
        type="button"
        onClick={() => onPageChange?.(page)}
        className={`cursor-pointer ${className}`}
      >
        {page}
      </button>
    );
  };

  return (
    <nav aria-label={ariaLabel} className="flex items-center gap-1">
      {renderArrow(
        currentPage - 1,
        "Previous page",
        PrevIcon,
        currentPage <= 1,
      )}

      {pages.map((page, index) =>
        page === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-sm app-muted"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          renderPage(page)
        ),
      )}

      {renderArrow(
        currentPage + 1,
        "Next page",
        NextIcon,
        currentPage >= totalPages,
      )}
    </nav>
  );
}
