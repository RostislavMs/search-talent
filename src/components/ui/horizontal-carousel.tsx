"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type HorizontalCarouselProps = {
  children: ReactNode;
  itemMinWidth?: number;
  ariaLabelPrev?: string;
  ariaLabelNext?: string;
};

const DRAG_THRESHOLD_PX = 6;

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
  const [isDragging, setIsDragging] = useState(false);

  const updateButtons = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setCanScrollPrev(node.scrollLeft > 4);
    setCanScrollNext(node.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    updateButtons();
    const node = scrollerRef.current;
    if (!node) return;

    node.addEventListener("scroll", updateButtons, { passive: true });
    const resize = new ResizeObserver(updateButtons);
    resize.observe(node);

    return () => {
      node.removeEventListener("scroll", updateButtons);
      resize.disconnect();
    };
  }, [updateButtons]);

  const scrollByPage = useCallback((direction: 1 | -1) => {
    const node = scrollerRef.current;
    if (!node) return;
    const step = Math.max(node.clientWidth * 0.85, itemMinWidth);
    node.scrollBy({ left: direction * step, behavior: "smooth" });
  }, [itemMinWidth]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Drag only with primary mouse button or non-mouse pointers.
      if (event.pointerType === "mouse" && event.button !== 0) return;

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

      if (!state.moved && Math.abs(delta) < DRAG_THRESHOLD_PX) {
        return;
      }

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
      // Block click events that result from a drag gesture so cards inside
      // the carousel don't navigate when the user just wanted to scroll.
      if (isDragging) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    [isDragging],
  );

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClickCapture={handleClickCapture}
        onDragStart={(event) => event.preventDefault()}
        className={`drag-scroller no-scrollbar -mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-2 ${
          isDragging
            ? "cursor-grabbing select-none scroll-auto"
            : "cursor-grab scroll-smooth"
        }`}
      >
        {Array.isArray(children)
          ? children.map((child, index) => (
              <div
                key={index}
                className="shrink-0 snap-start"
                style={{
                  width: `min(${itemMinWidth}px, 100%)`,
                  flexBasis: `${itemMinWidth}px`,
                }}
              >
                {child}
              </div>
            ))
          : (
              <div
                className="shrink-0 snap-start"
                style={{
                  width: `min(${itemMinWidth}px, 100%)`,
                  flexBasis: `${itemMinWidth}px`,
                }}
              >
                {children}
              </div>
            )}
      </div>

      {(canScrollPrev || canScrollNext) && (
        <>
          <button
            type="button"
            aria-label={ariaLabelPrev}
            disabled={!canScrollPrev}
            onClick={() => scrollByPage(-1)}
            className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border app-border bg-[color:var(--surface)] p-2 text-[color:var(--foreground)] shadow-md transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
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
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1/2 cursor-pointer rounded-full border app-border bg-[color:var(--surface)] p-2 text-[color:var(--foreground)] shadow-md transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
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
