"use client";

import { useEffect, useState } from "react";
import {
  getProfileCompletenessItemLabel,
  type ProfileCompletenessBreakdown,
} from "@/lib/profile-completeness";

function getStrings(locale: string) {
  if (locale === "uk") {
    return {
      label: (percent: number) => `Профіль ${percent}%`,
      modalTitle: "Заповненість профілю",
      modalSubtitle: (filled: number, total: number) =>
        `${filled} з ${total} полів заповнено`,
      close: "Закрити",
      filledSection: "Заповнено",
      missingSection: "Залишилось",
      allDone: "Все заповнено — чудова робота!",
      goToEdit: "Перейти до редагування",
    };
  }

  return {
    label: (percent: number) => `Profile ${percent}%`,
    modalTitle: "Profile completeness",
    modalSubtitle: (filled: number, total: number) =>
      `${filled} of ${total} fields filled`,
    close: "Close",
    filledSection: "Filled",
    missingSection: "Missing",
    allDone: "Everything is filled — great work!",
    goToEdit: "Open profile editor",
  };
}

function progressBarColor(percent: number) {
  if (percent >= 90) return "bg-emerald-500";
  if (percent >= 60) return "bg-sky-500";
  if (percent >= 30) return "bg-amber-500";
  return "bg-rose-500";
}

export default function ProfileCompletenessButton({
  completeness,
  locale,
  editHref,
}: {
  completeness: ProfileCompletenessBreakdown;
  locale: string;
  editHref: string;
}) {
  const [open, setOpen] = useState(false);
  const strings = getStrings(locale);
  const { items, percent } = completeness;
  const filled = items.filter((item) => item.filled);
  const missing = items.filter((item) => !item.filled);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : previous;
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border app-border bg-[color:var(--surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)] sm:text-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={strings.label(percent)}
      >
        <span
          className="relative inline-flex h-4 w-12 overflow-hidden rounded-full bg-[color:var(--surface-muted)]"
          aria-hidden="true"
        >
          <span
            className={`absolute inset-y-0 left-0 ${progressBarColor(percent)}`}
            style={{ width: `${percent}%` }}
          />
        </span>
        <span className="font-semibold">{strings.label(percent)}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-3 py-6 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-completeness-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
          style={{
            background: "rgba(2, 6, 23, 0.78)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-panel border app-border shadow-[0_28px_90px_rgba(2,6,23,0.6)]"
            style={{
              background: "var(--surface)",
              color: "var(--foreground)",
            }}
          >
            <div className="flex items-start justify-between gap-4 border-b app-border p-5 sm:p-6">
              <div className="min-w-0 flex-1">
                <h2
                  id="profile-completeness-title"
                  className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
                >
                  {strings.modalTitle}
                </h2>
                <p className="mt-1 text-sm app-muted">
                  {strings.modalSubtitle(filled.length, items.length)}
                </p>
                <div
                  className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-muted)]"
                  aria-hidden="true"
                >
                  <div
                    className={`h-full ${progressBarColor(percent)} transition-[width] duration-300`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold app-soft">{percent}%</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={strings.close}
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border app-border text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                style={{ background: "var(--surface)" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              {missing.length > 0 ? (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                    {strings.missingSection} · {missing.length}
                  </h3>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {missing.map((item) => (
                      <li
                        key={item.key}
                        className="flex items-center gap-2 rounded-xl border border-dashed app-border bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                      >
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border app-border text-[color:var(--muted-foreground)]"
                          aria-hidden="true"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M6 6l12 12M18 6L6 18"
                              stroke="currentColor"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                        <span>{getProfileCompletenessItemLabel(item.key, locale)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <section>
                  <p className="rounded-xl border app-border bg-[color:var(--surface-muted)] px-3 py-3 text-sm text-[color:var(--foreground)]">
                    🎉 {strings.allDone}
                  </p>
                </section>
              )}

              {filled.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-eyebrow app-soft">
                    {strings.filledSection} · {filled.length}
                  </h3>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {filled.map((item) => (
                      <li
                        key={item.key}
                        className="flex items-center gap-2 rounded-xl border app-border bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                      >
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
                          aria-hidden="true"
                        >
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="m5 12 5 5L20 7"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        <span>{getProfileCompletenessItemLabel(item.key, locale)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {missing.length > 0 && (
              <div className="border-t app-border p-4 sm:p-5">
                <a
                  href={editHref}
                  className="inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-[color:var(--foreground)] px-4 py-2 text-sm font-semibold text-[color:var(--background)] transition hover:opacity-90"
                >
                  {strings.goToEdit}
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
