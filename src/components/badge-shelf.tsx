"use client";

import { useEffect, useState } from "react";
import BadgeIcon from "@/components/badge-icon";
import {
  getBadgeDescription,
  getBadgeName,
  getNextBadgeLevel,
  getPublicBadges,
} from "@/lib/badge-display";
import type { BadgeWithProgress } from "@/lib/constants/badges";
import { useCurrentLocale, useDictionary } from "@/lib/i18n/client";
import { profileBadgesCopy } from "@/lib/i18n/copy/profile-badges";

type Copy = (typeof profileBadgesCopy)["uk" | "en"];

// Same chip as the rating next to the name: badges read as facts about the
// person, not as stickers, and look the same on every profile.
const CHIP_BASE =
  "cursor-pointer items-center gap-1.5 rounded-full app-panel px-2.5 py-0.5 text-xs transition hover:bg-[color:var(--surface-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--foreground)]/30 sm:text-sm";
const CHIP_CLASSES = `${CHIP_BASE} font-medium text-[color:var(--foreground)]`;

function formatAwardedAt(value: string, locale: string) {
  try {
    return new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

/**
 * Earned badges as text chips in the profile hero: the first few by weight,
 * the rest behind "+N". The owner also gets "Badges · N of M", which opens
 * the whole catalog with progress towards the next levels.
 */
export default function BadgeShelf({
  badges,
  isOwner,
  accentColor,
  className = "",
  maxVisible = 3,
  maxVisibleMobile = 2,
}: {
  badges: BadgeWithProgress[];
  isOwner: boolean;
  accentColor: string;
  className?: string;
  maxVisible?: number;
  maxVisibleMobile?: number;
}) {
  const [open, setOpen] = useState(false);
  const locale = useCurrentLocale();
  const copy = useDictionary({ profileBadges: profileBadgesCopy }).profileBadges;

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

  const shown = getPublicBadges(badges);
  if (shown.length === 0 && !isOwner) {
    return null;
  }

  const earned = badges.filter((entry) => entry.earned);
  const locked = badges.filter((entry) => !entry.earned);
  // The owner's "N of M" button already leads to everything.
  const hiddenMobile = isOwner ? 0 : Math.max(0, shown.length - maxVisibleMobile);
  const hiddenDesktop = isOwner ? 0 : Math.max(0, shown.length - maxVisible);

  return (
    <>
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {shown.slice(0, maxVisible).map((entry, index) => {
          const name = getBadgeName(entry.badge, entry.tier, locale);
          return (
            <button
              key={entry.badge.id}
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-label={`${name} — ${getBadgeDescription(entry.badge, locale)}`}
              className={`${index >= maxVisibleMobile ? "hidden sm:inline-flex" : "inline-flex"} ${CHIP_CLASSES}`}
            >
              <span className="shrink-0" style={{ color: accentColor }}>
                <BadgeIcon badgeKey={entry.badge.key} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              {name}
            </button>
          );
        })}
        {hiddenMobile > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-label={copy.showAll}
            className={`inline-flex sm:hidden ${CHIP_CLASSES}`}
          >
            +{hiddenMobile}
          </button>
        )}
        {hiddenDesktop > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-label={copy.showAll}
            className={`hidden sm:inline-flex ${CHIP_CLASSES}`}
          >
            +{hiddenDesktop}
          </button>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className={`inline-flex ${CHIP_BASE} border-dashed app-muted`}
          >
            {copy.ownerButton
              .replace("{earned}", String(earned.length))
              .replace("{total}", String(badges.length))}
          </button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-3 py-6 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-badges-title"
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
            className="flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-panel border app-border shadow-[0_28px_90px_rgba(2,6,23,0.6)]"
            style={{
              background: "var(--surface)",
              color: "var(--foreground)",
            }}
          >
            <div className="flex items-start justify-between gap-4 border-b app-border p-5 sm:p-6">
              <div className="min-w-0 flex-1">
                <h2
                  id="profile-badges-title"
                  className="font-display text-lg font-semibold tracking-tight text-[color:var(--foreground)]"
                >
                  {copy.title}
                </h2>
                {isOwner && (
                  <p className="mt-1 text-sm app-muted">
                    {copy.earnedOf
                      .replace("{earned}", String(earned.length))
                      .replace("{total}", String(badges.length))}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={copy.close}
                autoFocus
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border app-border text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
                style={{ background: "var(--surface)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
              {isOwner ? (
                <>
                  {earned.length > 0 && (
                    <BadgeSection
                      title={`${copy.earnedSection} · ${earned.length}`}
                      entries={earned}
                      isOwner
                      accentColor={accentColor}
                      locale={locale}
                      copy={copy}
                    />
                  )}
                  {locked.length > 0 && (
                    <BadgeSection
                      title={`${copy.lockedSection} · ${locked.length}`}
                      entries={locked}
                      isOwner
                      accentColor={accentColor}
                      locale={locale}
                      copy={copy}
                    />
                  )}
                </>
              ) : (
                <BadgeSection
                  entries={shown}
                  isOwner={false}
                  accentColor={accentColor}
                  locale={locale}
                  copy={copy}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BadgeSection({
  title,
  entries,
  isOwner,
  accentColor,
  locale,
  copy,
}: {
  title?: string;
  entries: BadgeWithProgress[];
  isOwner: boolean;
  accentColor: string;
  locale: string;
  copy: Copy;
}) {
  return (
    <section>
      {title && (
        <h3 className="text-xs font-semibold uppercase tracking-eyebrow app-soft">{title}</h3>
      )}
      <ul className={`divide-y divide-[color:var(--border)] ${title ? "mt-1" : "-my-3"}`}>
        {entries.map((entry) => (
          <BadgeRow
            key={entry.badge.id}
            entry={entry}
            isOwner={isOwner}
            accentColor={accentColor}
            locale={locale}
            copy={copy}
          />
        ))}
      </ul>
    </section>
  );
}

function BadgeRow({
  entry,
  isOwner,
  accentColor,
  locale,
  copy,
}: {
  entry: BadgeWithProgress;
  isOwner: boolean;
  accentColor: string;
  locale: string;
  copy: Copy;
}) {
  const { badge, earned, awardedAt } = entry;
  const next = isOwner ? getNextBadgeLevel(entry, locale) : null;
  // A locked badge already shows its first level's name; only the count adds.
  const nextLine = next
    ? [
        earned ? copy.nextLevel.replace("{name}", next.name) : null,
        next.current !== null
          ? copy.progress
              .replace("{current}", String(next.current))
              .replace("{threshold}", String(next.threshold)) +
            (badge.key === "veteran" ? ` ${copy.days}` : "")
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const meta = [
    earned && awardedAt
      ? copy.awardedOn.replace("{date}", formatAwardedAt(awardedAt, locale))
      : null,
    isOwner && earned && !badge.publicOnProfile ? copy.ownerOnly : null,
  ].filter(Boolean);

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border app-border ${earned ? "" : "app-soft"}`}
        style={earned ? { color: accentColor } : undefined}
      >
        <BadgeIcon badgeKey={badge.key} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${earned ? "text-[color:var(--foreground)]" : "app-muted"}`}>
          {getBadgeName(badge, entry.tier, locale)}
        </p>
        <p className="mt-0.5 text-sm leading-6 app-muted">{getBadgeDescription(badge, locale)}</p>
        {meta.length > 0 && <p className="mt-1 text-xs app-soft">{meta.join(" · ")}</p>}
        {next && nextLine && (
          <div className="mt-2">
            <p className="text-xs app-soft">{nextLine}</p>
            {next.current !== null && (
              <div
                className="mt-1.5 h-1 w-full max-w-48 overflow-hidden rounded-full bg-[color:var(--surface-muted)]"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (next.current / next.threshold) * 100)}%`,
                    background: accentColor,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
