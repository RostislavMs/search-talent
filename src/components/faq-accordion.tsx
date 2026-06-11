"use client";

import { useState } from "react";

/**
 * Animated FAQ list. Each item slides open/closed via a
 * grid-rows-[0fr] → grid-rows-[1fr] transition (the answer height eases
 * in rather than snapping). Items toggle independently. The answers stay
 * in the DOM at all times so the FAQ schema and crawlers still see them.
 */
export default function FaqAccordion({
  items,
}: {
  items: Array<{ question: string; answer: string }>;
}) {
  const [open, setOpen] = useState<Set<number>>(() => new Set());

  const toggle = (index: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="mt-6 grid gap-3 lg:grid-cols-2 lg:items-start">
      {items.map((item, index) => {
        const isOpen = open.has(index);
        const panelId = `faq-panel-${index}`;

        return (
          <div
            key={item.question}
            className="overflow-hidden rounded-3xl app-panel"
          >
            <button
              type="button"
              onClick={() => toggle(index)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-[color:var(--surface-muted)] sm:p-5"
            >
              <h3 className="text-base font-semibold text-[color:var(--foreground)]">
                {item.question}
              </h3>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`size-5 shrink-0 app-soft transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                <path d="M5 7.5 10 12.5 15 7.5" />
              </svg>
            </button>
            <div
              id={panelId}
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-sm leading-7 app-muted sm:px-5 sm:pb-5">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
