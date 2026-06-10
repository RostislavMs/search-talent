"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const noop = () => {};
const subscribeMount = () => noop;
const getClientMounted = () => true;
const getServerMounted = () => false;
import { createPortal } from "react-dom";
import BadgeIcon from "@/components/badge-icon";
import type { BadgeRarity, BadgeWithProgress } from "@/lib/constants/badges";

function getBadgeLabel(badge: BadgeWithProgress["badge"], locale: string) {
  if (locale === "uk") {
    return {
      name: badge.nameUk,
      description: badge.descriptionUk,
    };
  }

  return {
    name: badge.nameEn,
    description: badge.descriptionEn,
  };
}

function getRarityChipClasses(rarity: BadgeRarity) {
  switch (rarity) {
    case "very_rare":
      return "border-amber-400/70 bg-amber-50/95 text-amber-900 dark:border-amber-400/50 dark:bg-amber-500/15 dark:text-amber-100";
    case "rare":
      return "border-violet-400/70 bg-violet-50/95 text-violet-900 dark:border-violet-400/50 dark:bg-violet-500/15 dark:text-violet-100";
    case "uncommon":
      return "border-sky-400/70 bg-sky-50/95 text-sky-900 dark:border-sky-400/50 dark:bg-sky-500/15 dark:text-sky-100";
    case "common":
    default:
      return "app-border bg-[color:var(--surface)] text-[color:var(--foreground)]";
  }
}

const LOCKED_CHIP_CLASSES =
  "app-border bg-[color:var(--surface-muted)] text-[color:var(--muted-foreground)] opacity-60 grayscale";

function getTierDotColor(rarity: BadgeRarity) {
  switch (rarity) {
    case "very_rare":
      return "bg-amber-500";
    case "rare":
      return "bg-violet-500";
    case "uncommon":
      return "bg-sky-500";
    case "common":
    default:
      return "bg-[color:var(--foreground)]";
  }
}

function getRarityLabel(rarity: BadgeRarity, locale: string) {
  if (locale === "uk") {
    switch (rarity) {
      case "very_rare":
        return "Дуже рідкісний";
      case "rare":
        return "Рідкісний";
      case "uncommon":
        return "Незвичайний";
      case "common":
      default:
        return "Звичайний";
    }
  }
  switch (rarity) {
    case "very_rare":
      return "Very rare";
    case "rare":
      return "Rare";
    case "uncommon":
      return "Uncommon";
    case "common":
    default:
      return "Common";
  }
}

function formatAwardedAt(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getStrings(locale: string) {
  if (locale === "uk") {
    return {
      modalTitle: "Бейджі профілю",
      modalSubtitle: (earned: number, total: number) =>
        `${earned} з ${total} отримано`,
      close: "Закрити",
      awardedOn: "Отримано",
      tier: "Рівень",
      nextLevel: "Наступний рівень",
      maxLevel: "Максимальний рівень",
      locked: "Не отримано",
      firstThreshold: "Перший рівень",
      empty: "Поки що бейджів немає.",
      showAll: "Усі бейджі",
    };
  }

  return {
    modalTitle: "Profile badges",
    modalSubtitle: (earned: number, total: number) =>
      `${earned} of ${total} earned`,
    close: "Close",
    awardedOn: "Awarded on",
    tier: "Level",
    nextLevel: "Next level",
    maxLevel: "Max level",
    locked: "Not earned",
    firstThreshold: "First threshold",
    empty: "No badges yet.",
    showAll: "All badges",
  };
}

function renderTierDots(tier: number, rarity: BadgeRarity, earned: boolean) {
  const total = 3;
  return (
    <span className="flex items-center gap-0.5" aria-label={`Level ${tier} of ${total}`}>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={[
            "h-1.5 w-1.5 rounded-full",
            earned && index < tier
              ? getTierDotColor(rarity)
              : "bg-[color:var(--border)]",
          ].join(" ")}
        />
      ))}
    </span>
  );
}

export default function BadgeShelf({
  badges,
  locale,
  maxVisible,
  maxVisibleMobile,
}: {
  badges: BadgeWithProgress[];
  locale: string;
  maxVisible?: number;
  maxVisibleMobile?: number;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<{
    entry: BadgeWithProgress;
    top: number;
    left: number;
  } | null>(null);
  const mounted = useSyncExternalStore(
    subscribeMount,
    getClientMounted,
    getServerMounted,
  );
  const strings = getStrings(locale);

  const positionTooltip = (
    button: HTMLButtonElement | null,
    entry: BadgeWithProgress,
  ) => {
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setFocused({
      entry,
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
  };

  const clearTooltip = (id: number) => {
    setFocused((current) => (current?.entry.badge.id === id ? null : current));
  };

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

  useEffect(() => {
    if (!focused) return;
    const onScrollOrResize = () => setFocused(null);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [focused]);

  if (badges.length === 0) {
    return null;
  }

  const earnedCount = badges.filter((entry) => entry.earned).length;
  const desktopMax = maxVisible ?? badges.length;
  const mobileMax = maxVisibleMobile ?? desktopMax;
  const visibleBadges = badges.slice(0, desktopMax);
  const mobileHidden = Math.max(0, badges.length - mobileMax);
  const desktopHidden = Math.max(0, badges.length - desktopMax);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {visibleBadges.map((entry, index) => {
          const { badge, earned, tier } = entry;
          const { name, description } = getBadgeLabel(badge, locale);
          const showsTierDots = badge.tierThresholds.length > 1;
          const chipClasses = earned
            ? getRarityChipClasses(badge.rarity)
            : LOCKED_CHIP_CLASSES;
          const ariaLabel = earned
            ? `${name} — ${description}`
            : `${strings.locked}: ${name} — ${description}`;
          return (
            <button
              key={badge.id}
              type="button"
              onClick={() => setOpen(true)}
              onMouseEnter={(event) =>
                positionTooltip(event.currentTarget, entry)
              }
              onMouseLeave={() => clearTooltip(badge.id)}
              onFocus={(event) =>
                positionTooltip(event.currentTarget, entry)
              }
              onBlur={() => clearTooltip(badge.id)}
              aria-label={ariaLabel}
              className={[
                index >= mobileMax ? "hidden sm:inline-flex" : "inline-flex",
                "relative h-10 w-10 cursor-pointer items-center justify-center rounded-full border shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[color:var(--foreground)]/30",
                chipClasses,
              ].join(" ")}
            >
              <BadgeIcon badgeKey={badge.key} className="h-5 w-5" />
              {earned && showsTierDots && tier > 1 && (
                <span className="absolute -bottom-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border app-border bg-[color:var(--surface)] px-1 text-[10px] font-bold leading-none text-[color:var(--foreground)] shadow-sm">
                  {tier}
                </span>
              )}
              {!earned && (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1 -right-1 inline-flex h-4 w-4 items-center justify-center rounded-full border app-border bg-[color:var(--surface)] text-[color:var(--muted-foreground)] shadow-sm"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5" aria-hidden="true">
                    <path d="M5 7V5a3 3 0 0 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
        {mobileHidden > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={strings.showAll}
            title={strings.showAll}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border app-border bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--foreground)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[color:var(--foreground)]/30 sm:hidden"
          >
            +{mobileHidden}
          </button>
        )}
        {desktopHidden > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={strings.showAll}
            title={strings.showAll}
            className="hidden h-10 cursor-pointer items-center justify-center rounded-full border app-border bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--foreground)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[color:var(--foreground)]/30 sm:inline-flex"
          >
            +{desktopHidden}
          </button>
        )}
      </div>

      {mounted && focused &&
        createPortal(
          (() => {
            const { entry, top, left } = focused;
            const { badge, earned, tier } = entry;
            const { name, description } = getBadgeLabel(badge, locale);
            const showsTierDots = badge.tierThresholds.length > 1;
            return (
              <div
                role="tooltip"
                className="pointer-events-none fixed z-[60] w-56 -translate-x-1/2 rounded-xl border app-border p-3 text-left text-xs shadow-lg"
                style={{
                  top,
                  left,
                  background: "var(--surface)",
                  color: "var(--foreground)",
                }}
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--foreground)]">
                  <span>{name}</span>
                  {earned && showsTierDots && (
                    <span className="text-xs font-medium app-muted">
                      · {strings.tier} {tier}/{badge.tierThresholds.length}
                    </span>
                  )}
                  {!earned && (
                    <span className="text-[10px] font-semibold uppercase tracking-eyebrow app-muted">
                      · {strings.locked}
                    </span>
                  )}
                </p>
                <p className="mt-1 leading-5 app-muted">{description}</p>
                {showsTierDots && (
                  <div className="mt-2">
                    {renderTierDots(tier, badge.rarity, earned)}
                  </div>
                )}
              </div>
            );
          })(),
          document.body,
        )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-3 py-6 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-modal-title"
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
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-panel border app-border shadow-[0_28px_90px_rgba(2,6,23,0.6)]"
            style={{
              background: "var(--surface)",
              color: "var(--foreground)",
            }}
          >
            <div className="flex items-start justify-between gap-4 border-b app-border p-5 sm:p-6">
              <div>
                <h2
                  id="badge-modal-title"
                  className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
                >
                  {strings.modalTitle}
                </h2>
                <p className="mt-1 text-sm app-muted">
                  {strings.modalSubtitle(earnedCount, badges.length)}
                </p>
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

            <ul className="flex-1 space-y-3 overflow-y-auto p-5 sm:p-6">
              {badges.map((entry) => {
                const { badge, earned, tier, awardedAt } = entry;
                const { name, description } = getBadgeLabel(badge, locale);
                const tieredBadge = badge.tierThresholds.length > 1;
                const isMaxTier = earned && tier >= badge.tierThresholds.length;
                const nextThreshold = earned && !isMaxTier
                  ? badge.tierThresholds[tier]
                  : null;
                return (
                  <li
                    key={badge.id}
                    className={[
                      "flex items-start gap-3 rounded-2xl border p-4",
                      earned
                        ? getRarityChipClasses(badge.rarity)
                        : LOCKED_CHIP_CLASSES,
                    ].join(" ")}
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border app-border"
                      style={{ background: "var(--surface)" }}
                    >
                      <BadgeIcon badgeKey={badge.key} className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <h3 className="font-semibold">{name}</h3>
                        <span className="text-xs uppercase tracking-eyebrow opacity-70">
                          {getRarityLabel(badge.rarity, locale)}
                        </span>
                        {earned && tieredBadge && (
                          <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-semibold">
                            {strings.tier} {tier}/{badge.tierThresholds.length}
                          </span>
                        )}
                        {!earned && (
                          <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-eyebrow">
                            {strings.locked}
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-6 opacity-90">
                        {description}
                      </p>
                      {tieredBadge && (
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                          {renderTierDots(tier, badge.rarity, earned)}
                          <span className="opacity-80">
                            {earned
                              ? isMaxTier
                                ? strings.maxLevel
                                : `${strings.nextLevel}: ${nextThreshold}`
                              : `${strings.firstThreshold}: ${badge.tierThresholds[0]}`}
                          </span>
                        </div>
                      )}
                      {earned && awardedAt && (
                        <p className="mt-2 text-xs opacity-70">
                          {strings.awardedOn}: {formatAwardedAt(awardedAt, locale)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
