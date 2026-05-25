"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const DRAG_THRESHOLD_PX = 6;

type HorizontalCarouselProps = {
  children: ReactNode;
  itemMinWidth?: number;
  ariaLabelPrev?: string;
  ariaLabelNext?: string;
};

export default function HorizontalCarousel({
  children,
  itemMinWidth = 280,
  ariaLabelPrev = "Previous",
  ariaLabelNext = "Next",
}: HorizontalCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const items = Array.isArray(children) ? children : [children];
  const itemCount = items.length;

  const updateState = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setCanScrollPrev(node.scrollLeft > 4);
    setCanScrollNext(node.scrollLeft < max - 4);

    const viewportCentre = node.scrollLeft + node.clientWidth / 2;
    let closest = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    Array.from(node.children).forEach((child, index) => {
      const el = child as HTMLElement;
      const centre = el.offsetLeft + el.offsetWidth / 2;
      const distance = Math.abs(centre - viewportCentre);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    });
    setActiveIndex(closest);
  }, []);

  useEffect(() => {
    updateState();
    const node = scrollerRef.current;
    if (!node) return;

    node.addEventListener("scroll", updateState, { passive: true });
    const resize = new ResizeObserver(updateState);
    resize.observe(node);

    return () => {
      node.removeEventListener("scroll", updateState);
      resize.disconnect();
    };
  }, [updateState]);

  const scrollByPage = useCallback(
    (direction: 1 | -1) => {
      const node = scrollerRef.current;
      if (!node) return;
      const step = Math.max(node.clientWidth * 0.9, itemMinWidth);
      node.scrollBy({ left: direction * step, behavior: "smooth" });
    },
    [itemMinWidth],
  );

  const scrollToIndex = useCallback((index: number) => {
    const node = scrollerRef.current;
    if (!node) return;
    const target = node.children[index] as HTMLElement | undefined;
    if (!target) return;
    node.scrollTo({
      left: target.offsetLeft - (node.clientWidth - target.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, []);

  // Mouse-only drag: lets desktop users grab and slide the carousel.
  // Touch & pen are intentionally NOT captured here so the browser can
  // run its native scroll + scroll-snap pipeline (which is what makes
  // mobile swipe work).
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse") return;
      if (event.button !== 0) return;

      const node = scrollerRef.current;
      if (!node) return;

      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: node.scrollLeft,
        moved: false,
      };
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;

      const node = scrollerRef.current;
      if (!node) return;

      const delta = event.clientX - state.startX;
      if (!state.moved && Math.abs(delta) < DRAG_THRESHOLD_PX) return;

      if (!state.moved) {
        state.moved = true;
        setIsDragging(true);
        try {
          (event.target as Element).setPointerCapture(event.pointerId);
        } catch {
          // ignore — non-capturable target
        }
      }

      event.preventDefault();
      node.scrollLeft = state.startScrollLeft - delta;
    },
    [],
  );

  const finishDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    dragStateRef.current = null;

    if (state.moved) {
      setIsDragging(false);
      try {
        (event.target as Element).releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [isDragging],
  );

  // Inline width is used instead of Tailwind arbitrary values because the
  // CSS-var + flex-context combination collapsed items in v4, killing
  // horizontal overflow. On mobile each card takes 85vw capped at
  // itemMinWidth so a peek of the next card is visible; on larger screens
  // the cap dominates.
  const itemStyle: CSSProperties = {
    width: `min(85vw, ${itemMinWidth}px)`,
    flexBasis: `min(85vw, ${itemMinWidth}px)`,
  };
  const showDots = itemCount > 1;

  return (
    <div className="relative min-w-0">
      <div
        ref={scrollerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={handleClickCapture}
        onDragStart={(event) => event.preventDefault()}
        className={`no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:-mx-2 sm:px-2 ${
          isDragging
            ? "cursor-grabbing select-none scroll-auto"
            : "cursor-grab scroll-smooth"
        }`}
      >
        {items.map((child, index) => (
          <div
            key={index}
            className="shrink-0 snap-center sm:snap-start"
            style={itemStyle}
          >
            {child}
          </div>
        ))}
      </div>

      {showDots && (
        <div
          className="mt-3 flex justify-center gap-1.5 sm:hidden"
          role="tablist"
          aria-label={ariaLabelNext}
        >
          {items.map((_, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`${index + 1} / ${itemCount}`}
                onClick={() => scrollToIndex(index)}
                className={`h-1.5 cursor-pointer rounded-full transition-all ${
                  isActive
                    ? "w-5 bg-[color:var(--foreground)]"
                    : "w-1.5 bg-[color:var(--surface-muted)]"
                }`}
              />
            );
          })}
        </div>
      )}

      {(canScrollPrev || canScrollNext) && (
        <>
          <button
            type="button"
            aria-label={ariaLabelPrev}
            disabled={!canScrollPrev}
            onClick={() => scrollByPage(-1)}
            className="absolute left-0 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border app-border bg-[color:var(--surface)] p-2 text-[color:var(--foreground)] shadow-md transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40 sm:block"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12.78 4.97a.75.75 0 0 1 0 1.06L8.81 10l3.97 3.97a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <button
            type="button"
            aria-label={ariaLabelNext}
            disabled={!canScrollNext}
            onClick={() => scrollByPage(1)}
            className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 translate-x-1/2 cursor-pointer rounded-full border app-border bg-[color:var(--surface)] p-2 text-[color:var(--foreground)] shadow-md transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40 sm:block"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.22 4.97a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06L11.19 10 7.22 6.03a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
