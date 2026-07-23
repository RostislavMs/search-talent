"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { buttonStyles } from "@/components/ui/button-styles";
import type { ActivePopup } from "@/lib/db/popups";
import { useDictionary } from "@/lib/i18n/client";
import { isLocale } from "@/lib/i18n/config";

// Frequency = once per browser session (see product decision). Keyed by popup
// id so editing/replacing the active popup re-triggers for returning visitors.
const SESSION_PREFIX = "st_popup_seen_";

// Where the feedback-kind popup sends the visitor.
const FEEDBACK_PATH = "/feedback";

// Pages where an interruptive popup is inappropriate: auth flows, the admin
// console, and the feedback page itself (no point nudging you toward it).
const SUPPRESSED_SEGMENTS = new Set([
  "login",
  "signup",
  "forgot-password",
  "reset-password",
  "verify",
  "admin",
  "feedback",
]);

function isSuppressedPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  const segments = pathname.split("/").filter(Boolean);
  // Drop a leading locale segment (/uk/login -> login).
  const first = segments[0] && isLocale(segments[0]) ? segments[1] : segments[0];
  return first ? SUPPRESSED_SEGMENTS.has(first) : false;
}

// Matches the CSS transition duration below, so we unmount only after the
// leave animation finishes.
const LEAVE_MS = 180;

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function readSeen(id: string) {
  try {
    return window.sessionStorage.getItem(`${SESSION_PREFIX}${id}`) === "1";
  } catch {
    return false;
  }
}

function markSeen(id: string) {
  try {
    window.sessionStorage.setItem(`${SESSION_PREFIX}${id}`, "1");
  } catch {
    // Private mode / storage disabled — the popup simply shows again next load.
  }
}

type SitePopupProps = {
  popup: ActivePopup | null;
};

export default function SitePopup({ popup }: SitePopupProps) {
  const dictionary = useDictionary();
  const copy = dictionary.sitePopup;

  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const popupId = popup?.id ?? null;
  const delayMs = popup ? Math.max(0, popup.delaySeconds) * 1000 : 0;

  // Feedback popups route to the feedback page and always carry sensible
  // default copy so the modal is never empty. Message popups use the
  // admin-authored content and CTA.
  const isFeedback = popup?.kind === "feedback";
  const title = popup
    ? popup.title || (isFeedback ? copy.feedbackDefaultTitle : "")
    : "";
  const body = popup
    ? popup.body || (isFeedback ? copy.feedbackDefaultBody : "")
    : "";
  const ctaLabel = popup
    ? isFeedback
      ? copy.feedbackCta
      : popup.ctaLabel || ""
    : "";
  const ctaHref = popup
    ? isFeedback
      ? FEEDBACK_PATH
      : popup.ctaHref || ""
    : "";

  // A message popup with no title, body, or CTA has nothing to show — never
  // mount it (otherwise it would lock scroll behind an invisible overlay).
  const hasContent =
    Boolean(popup) &&
    (isFeedback || Boolean(title) || Boolean(body) || Boolean(ctaLabel));

  // Suppress the popup on auth/admin/feedback pages where it is out of place.
  const pathname = usePathname();
  const canShow = hasContent && !isSuppressedPath(pathname);

  const handleClose = useCallback(() => {
    if (popupId) {
      markSeen(popupId);
    }
    // Play the leave transition, then unmount.
    setEntered(false);
    window.setTimeout(() => setDismissed(true), LEAVE_MS);
  }, [popupId]);

  // Show after the configured delay, unless already seen this session.
  useEffect(() => {
    if (!popupId || !canShow || readSeen(popupId)) {
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [popupId, delayMs, canShow]);

  // Play the enter transition on the next frame after mount, and lock body
  // scroll while the modal is open.
  useEffect(() => {
    if (!visible || dismissed || !canShow) {
      return;
    }

    const frame = window.requestAnimationFrame(() => setEntered(true));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [visible, dismissed, canShow]);

  // Close on Escape.
  useEffect(() => {
    if (!visible || dismissed || !canShow) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, dismissed, canShow, handleClose]);

  if (!popup || !visible || dismissed || !canShow) {
    return null;
  }

  return (
    <div
      className={[
        "fixed inset-0 z-[60] flex items-center justify-center px-4 py-6 transition-opacity duration-200",
        "bg-[color:var(--foreground)]/45 backdrop-blur-sm",
        entered ? "opacity-100" : "opacity-0",
      ].join(" ")}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title || copy.regionLabel}
        className={[
          "app-card relative w-full max-w-md rounded-hero p-6 text-left shadow-2xl transition-all duration-200 sm:p-8",
          entered
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-95 opacity-0",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label={copy.close}
          className="absolute right-4 top-4 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border app-border bg-[color:var(--surface)] text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <span
          aria-hidden="true"
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--brand-soft)] text-[color:var(--brand-on-soft)]"
        >
          {isFeedback ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="M12 8h.01M11 11.5h1V16h1"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>

        {title ? (
          <h2 className="font-display mt-4 pr-8 text-xl font-medium tracking-tight text-[color:var(--foreground)]">
            {title}
          </h2>
        ) : null}

        {body ? (
          <p className="mt-2 whitespace-pre-line text-sm leading-7 app-muted">
            {body}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {ctaLabel && ctaHref ? (
            isExternalHref(ctaHref) ? (
              <a
                href={ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClose}
                className={buttonStyles({})}
              >
                {ctaLabel}
              </a>
            ) : (
              <ButtonLink href={ctaHref} onClick={handleClose}>
                {ctaLabel}
              </ButtonLink>
            )
          ) : null}

          <button
            type="button"
            onClick={handleClose}
            className={buttonStyles({ variant: "secondary" })}
          >
            {copy.dismiss}
          </button>
        </div>
      </section>
    </div>
  );
}
