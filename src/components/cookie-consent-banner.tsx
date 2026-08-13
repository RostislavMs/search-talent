"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LocalizedLink from "@/components/ui/localized-link";
import { buttonStyles } from "@/components/ui/button-styles";
import { isAuthRoute } from "@/lib/auth-routes";
import {
  allowsCookieCategory,
  buildAllowAllConsent,
  buildCookieConsent,
  buildEssentialOnlyConsent,
  buildLimitedConsent,
  cookieConsentOpenEvent,
  emitCookieConsentUpdated,
  persistCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";
import { useDictionary } from "@/lib/i18n/client";
import {
  clearThemePreferencePersistence,
  getThemeFromDocument,
  persistThemePreference,
} from "@/lib/theme-client";

type CookieConsentBannerProps = {
  initialConsent: CookieConsent | null;
};

export default function CookieConsentBanner({
  initialConsent,
}: CookieConsentBannerProps) {
  const dictionary = useDictionary();
  const pathname = usePathname();
  const [consent, setConsent] = useState(initialConsent);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [draft, setDraft] = useState(
    initialConsent?.categories ?? buildEssentialOnlyConsent().categories,
  );

  // The banner is suppressed on the auth screens, never skipped: an unanswered
  // consent keeps every optional category off, so the visitor simply gets asked
  // on the next page instead of on top of the sign-in form.
  const showBanner = consent === null && !isAuthRoute(pathname);

  useEffect(() => {
    const openPreferences = () => {
      setDraft((consent ?? buildLimitedConsent()).categories);
      setIsPreferencesOpen(true);
    };

    window.addEventListener(cookieConsentOpenEvent, openPreferences);

    return () => {
      window.removeEventListener(cookieConsentOpenEvent, openPreferences);
    };
  }, [consent]);

  useEffect(() => {
    if (!isPreferencesOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isPreferencesOpen]);

  function applyConsent(nextConsent: CookieConsent) {
    persistCookieConsent(nextConsent);

    if (allowsCookieCategory(nextConsent, "preferences")) {
      persistThemePreference(getThemeFromDocument());
    } else {
      clearThemePreferencePersistence();
    }

    setConsent(nextConsent);
    setDraft(nextConsent.categories);
    setIsPreferencesOpen(false);
    emitCookieConsentUpdated(nextConsent);
  }

  function saveCustomConsent() {
    applyConsent(
      buildCookieConsent({
        preferences: draft.preferences,
        analytics: draft.analytics,
        marketing: draft.marketing,
      }),
    );
  }

  const categories = [
    {
      key: "essential",
      label: dictionary.cookieConsent.essentialTitle,
      description: dictionary.cookieConsent.essentialDescription,
      checked: true,
      disabled: true,
    },
    {
      key: "preferences",
      label: dictionary.cookieConsent.preferencesTitle,
      description: dictionary.cookieConsent.preferencesDescription,
      checked: draft.preferences,
      disabled: false,
    },
    {
      key: "analytics",
      label: dictionary.cookieConsent.analyticsTitle,
      description: dictionary.cookieConsent.analyticsDescription,
      checked: draft.analytics,
      disabled: false,
    },
    {
      key: "marketing",
      label: dictionary.cookieConsent.marketingTitle,
      description: dictionary.cookieConsent.marketingDescription,
      checked: draft.marketing,
      disabled: false,
    },
  ] as const;

  return (
    <>
      {isPreferencesOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/45 px-4 py-4 sm:items-center sm:px-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-settings-title"
            className="mx-auto w-full max-w-xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-hero border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-2xl"
          >
            <div className="relative">
              <div className="pr-10">
                <h2
                  id="cookie-settings-title"
                  className="font-display text-lg font-medium tracking-tight text-[color:var(--foreground)]"
                >
                  {dictionary.cookieConsent.modalTitle}
                </h2>
                <p className="mt-1.5 text-xs leading-5 app-muted">
                  {dictionary.cookieConsent.modalDescription}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsPreferencesOpen(false)}
                aria-label={dictionary.cookieConsent.close}
                className="absolute -right-1 -top-1 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition-colors hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
              >
                <svg
                  width="16"
                  height="16"
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

            <div className="mt-4 space-y-2">
              {categories.map((category) => (
                <label
                  key={category.key}
                  className="flex items-start gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3.5 py-3"
                >
                  <input
                    type="checkbox"
                    className="app-checkbox mt-0.5"
                    checked={category.checked}
                    disabled={category.disabled}
                    onChange={(event) => {
                      if (category.disabled) {
                        return;
                      }

                      setDraft((current) => ({
                        ...current,
                        [category.key]: event.target.checked,
                      }));
                    }}
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
                      <span>{category.label}</span>
                      {category.disabled && (
                        <span className="text-[11px] font-normal app-soft">
                          {dictionary.cookieConsent.alwaysActive}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 app-muted">
                      {category.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => applyConsent(buildEssentialOnlyConsent())}
                className={buttonStyles({
                  variant: "secondary",
                  size: "sm",
                  className: "justify-center",
                })}
              >
                {dictionary.cookieConsent.rejectOptional}
              </button>
              <button
                type="button"
                onClick={() => applyConsent(buildAllowAllConsent())}
                className={buttonStyles({
                  variant: "secondary",
                  size: "sm",
                  className: "justify-center",
                })}
              >
                {dictionary.cookieConsent.allowAll}
              </button>
              <button
                type="button"
                onClick={saveCustomConsent}
                className={buttonStyles({
                  size: "sm",
                  className: "col-span-2 justify-center",
                })}
              >
                {dictionary.cookieConsent.saveSelection}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-6 sm:pb-4">
          <section className="mx-auto flex max-h-[calc(100dvh-1.5rem)] max-w-3xl flex-col gap-2.5 overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3.5 shadow-2xl sm:gap-3">
            <p className="text-xs leading-5 app-muted">
              {dictionary.cookieConsent.title}{" "}
              <LocalizedLink
                href="/cookies"
                className="font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
              >
                {dictionary.cookieConsent.learnMore}
              </LocalizedLink>
            </p>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => applyConsent(buildEssentialOnlyConsent())}
                className={buttonStyles({
                  variant: "secondary",
                  size: "sm",
                  className: "justify-center",
                })}
              >
                {dictionary.cookieConsent.rejectOptional}
              </button>
              <button
                type="button"
                onClick={() => applyConsent(buildLimitedConsent())}
                className={buttonStyles({
                  variant: "secondary",
                  size: "sm",
                  className: "justify-center",
                })}
              >
                {dictionary.cookieConsent.limitedUse}
              </button>
              <button
                type="button"
                onClick={() => setIsPreferencesOpen(true)}
                className={buttonStyles({
                  variant: "secondary",
                  size: "sm",
                  className: "justify-center",
                })}
              >
                {dictionary.cookieConsent.customize}
              </button>
              <button
                type="button"
                onClick={() => applyConsent(buildAllowAllConsent())}
                className={buttonStyles({
                  variant: "secondary",
                  size: "sm",
                  className: "justify-center",
                })}
              >
                {dictionary.cookieConsent.allowAll}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
