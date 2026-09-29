"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { buttonStyles, type ButtonVariant } from "@/components/ui/button-styles";
import LocalizedLink from "@/components/ui/localized-link";
import { apiFetch } from "@/lib/api-client";
import { useLoginHref } from "@/lib/auth/use-login-href";
import { useDictionary } from "@/lib/i18n/client";
import type { PreferredContactMethod } from "@/lib/profile-sections";

type ContactChannel = PreferredContactMethod;

type RevealState =
  | { status: "idle" | "loading" | "rate_limited" | "error" }
  | { status: "ready"; email: string | null; phone: string | null };

export type ProfileContactInfo = {
  profileId: string;
  displayName: string;
  telegram: string | null;
  linkedin: string | null;
  website: string | null;
  preferred: PreferredContactMethod | null;
  hasEmail: boolean;
  hasPhone: boolean;
  /** «Відкрито до: …» already worded for this locale, or null. */
  openToLine: string | null;
  /** "from 20 USD per hour", when the owner shows the rate; or null. */
  hourlyRateLine: string | null;
  /** Work formats already worded ("Remote, Hybrid"), or null. */
  workFormatsLine: string | null;
};

/** Channels in the order shown: the preferred one first. */
export function orderContactChannels(
  available: readonly ContactChannel[],
  preferred: PreferredContactMethod | null,
): ContactChannel[] {
  const order: ContactChannel[] = ["email", "phone", "telegram", "linkedin", "website"];
  const sorted = order.filter((channel) => available.includes(channel));

  if (preferred && sorted.includes(preferred)) {
    return [preferred, ...sorted.filter((channel) => channel !== preferred)];
  }

  return sorted;
}

function telegramUrl(handle: string) {
  return `https://t.me/${handle.replace(/^@/, "")}`;
}

/**
 * «Зв'язатися»: a button plus the dialog with the author's ways to get in
 * touch. Telegram, LinkedIn and the site are public anyway; email and phone
 * are loaded from /api/profile-contacts only for a signed-in visitor, which
 * also counts the opening for the author and caps address harvesting.
 */
export default function ProfileContactButton({
  contact,
  isAuthenticated,
  label,
  variant = "primary",
}: {
  contact: ProfileContactInfo;
  isAuthenticated: boolean;
  label?: string;
  variant?: ButtonVariant;
}) {
  const dictionary = useDictionary();
  const t = dictionary.openTo;
  const loginHref = useLoginHref();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState<RevealState>({ status: "idle" });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const loadPrivate = useCallback(async () => {
    setReveal({ status: "loading" });

    const result = await apiFetch<{ email: string | null; phone: string | null }>(
      "/api/profile-contacts",
      { method: "POST", body: { profileId: contact.profileId } },
    );

    if (result.ok) {
      setReveal({ status: "ready", email: result.data.email, phone: result.data.phone });
    } else {
      setReveal({ status: result.status === 429 ? "rate_limited" : "error" });
    }
  }, [contact.profileId]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const openDialog = () => {
    setOpen(true);

    // Signed in: always ask, even without email or phone on file, so the author's
    // "opened your contacts" count covers everyone who pressed the button.
    if (isAuthenticated && (reveal.status === "idle" || reveal.status === "error")) {
      void loadPrivate();
    }
  };

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  const available: ContactChannel[] = [];
  if (contact.hasEmail) available.push("email");
  if (contact.hasPhone) available.push("phone");
  if (contact.telegram) available.push("telegram");
  if (contact.linkedin) available.push("linkedin");
  if (contact.website) available.push("website");
  const channels = orderContactChannels(available, contact.preferred);
  const privateChannels = channels.filter((channel) => channel === "email" || channel === "phone");
  // A guest sees the public channels and, instead of email / phone, the sign-in note.
  const visibleChannels = isAuthenticated
    ? channels
    : channels.filter((channel) => channel !== "email" && channel !== "phone");

  const channelLabel: Record<ContactChannel, string> = {
    email: t.email,
    phone: t.phone,
    telegram: t.telegram,
    linkedin: t.linkedin,
    website: t.website,
  };

  const renderValue = (channel: ContactChannel) => {
    const linkClass =
      "break-all text-sm font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4 transition hover:decoration-[color:var(--foreground)]";

    switch (channel) {
      case "telegram": {
        const handle = (contact.telegram || "").replace(/^@/, "");
        return (
          <a href={telegramUrl(handle)} target="_blank" rel="noreferrer" className={linkClass}>
            @{handle}
          </a>
        );
      }
      case "linkedin":
        return (
          <a href={contact.linkedin || ""} target="_blank" rel="noreferrer" className={linkClass}>
            {(contact.linkedin || "").replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        );
      case "website":
        return (
          <a href={contact.website || ""} target="_blank" rel="noreferrer" className={linkClass}>
            {(contact.website || "").replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        );
      case "email":
      case "phone": {
        if (reveal.status === "ready") {
          const value = channel === "email" ? reveal.email : reveal.phone;

          if (!value) {
            return <span className="text-sm app-muted">—</span>;
          }

          return (
            <a href={`${channel === "email" ? "mailto" : "tel"}:${value}`} className={linkClass}>
              {value}
            </a>
          );
        }

        return <span className="text-sm app-muted">{reveal.status === "loading" ? t.loading : "••••••"}</span>;
      }
    }
  };

  const renderRow = (channel: ContactChannel) => (
    <li
      key={channel}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border app-border px-3 py-2.5"
    >
      <div className="min-w-0">
        <p className="text-xs app-muted">{channelLabel[channel]}</p>
        <div className="mt-0.5">{renderValue(channel)}</div>
      </div>
      {channel === contact.preferred ? (
        <span className="shrink-0 rounded-full bg-[color:var(--surface-muted)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--foreground)]">
          {t.preferred}
        </span>
      ) : null}
    </li>
  );

  const dialog = open ? (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(2,6,23,0.55)] px-3 py-6 sm:items-center sm:px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-panel border app-border bg-[color:var(--surface)] text-left text-[color:var(--foreground)] shadow-[0_28px_90px_rgba(2,6,23,0.4)]"
      >
        <div className="flex items-start justify-between gap-4 border-b app-border p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight">
              {t.dialogTitle.replace("{name}", contact.displayName)}
            </h2>
            {contact.openToLine ? (
              <p className="mt-2 flex items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>{contact.openToLine}</span>
              </p>
            ) : null}
            {contact.hourlyRateLine ? (
              <p className="mt-1 text-sm app-muted">{contact.hourlyRateLine}</p>
            ) : null}
            {contact.workFormatsLine ? (
              <p className="mt-1 text-sm app-muted">{contact.workFormatsLine}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={t.close}
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border app-border transition hover:bg-[color:var(--surface-muted)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {channels.length === 0 ? <p className="text-sm app-muted">{t.noChannels}</p> : null}

          {visibleChannels.length > 0 ? (
            <ul className="space-y-2">{visibleChannels.map(renderRow)}</ul>
          ) : null}

          {!isAuthenticated && privateChannels.length > 0 ? (
            <div className="rounded-xl bg-[color:var(--surface-muted)] p-4">
              <p className="text-sm leading-6">{t.privateSignIn}</p>
              <LocalizedLink href={loginHref} className={buttonStyles({ size: "sm", className: "mt-3" })}>
                {t.signIn}
              </LocalizedLink>
            </div>
          ) : null}

          {reveal.status === "rate_limited" ? (
            <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
              {t.rateLimited}
            </p>
          ) : null}

          {reveal.status === "error" ? (
            <div className="flex flex-wrap items-center gap-3" role="alert">
              <p className="text-sm text-rose-600 dark:text-rose-400">{t.loadFailed}</p>
              <Button variant="secondary" size="sm" onClick={() => void loadPrivate()}>
                {t.retry}
              </Button>
            </div>
          ) : null}
        </div>

        <p className="border-t app-border px-5 py-3 text-xs leading-5 app-muted">{t.directDeal}</p>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        ref={triggerRef}
        variant={variant}
        size="sm"
        onClick={openDialog}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {label ?? t.contact}
      </Button>
      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
