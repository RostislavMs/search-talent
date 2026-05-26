"use client";

import { useEffect, useState } from "react";
import LocalizedLink from "@/components/ui/localized-link";
import { buttonStyles } from "@/components/ui/button-styles";
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
  const [consent, setConsent] = useState(initialConsent);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [draft, setDraft] = useState(
    initialConsent?.categories ?? buildEssentialOnlyConsent().categories,
  );

  const showBanner = consent === null;

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
            className="mx-auto w-full max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-hero border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-2xl sm:p-8"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
                  {dictionary.cookieConsent.badge}
                </p>
                <h2
                  id="cookie-settings-title"
                  className="font-display mt-3 text-2xl font-medium tracking-tight text-[color:var(--foreground)]"
                >
                  {dictionary.cookieConsent.modalTitle}
                </h2>
                <p className="mt-3 text-sm leading-7 app-muted sm:text-base">
                  {dictionary.cookieConsent.modalDescription}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsPreferencesOpen(false)}
                className={buttonStyles({
                  variant: "ghost",
                  size: "sm",
                })}
              >
                {dictionary.cookieConsent.close}
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {categories.map((category) => (
                <label
                  key={category.key}
                  className="flex items-start gap-4 rounded-3xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4"
                >
                  <input
                    type="checkbox"
                    className="app-checkbox mt-1"
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
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[color:var(--foreground)] sm:text-base">
                      <span>{category.label}</span>
                      {category.disabled && (
                        <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] app-soft">
                          {dictionary.cookieConsent.alwaysActive}
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block text-sm leading-7 app-muted">
                      {category.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => applyConsent(buildEssentialOnlyConsent())}
                className={buttonStyles({
                  variant: "secondary",
                  className: "justify-center",
                })}
              >
                {dictionary.cookieConsent.rejectOptional}
              </button>
              <button
                type="button"
                onClick={saveCustomConsent}
                className={buttonStyles({
                  variant: "secondary",
                  className: "justify-center",
                })}
              >
                {dictionary.cookieConsent.saveSelection}
              </button>
              <button
                type="button"
                onClick={() => applyConsent(buildAllowAllConsent())}
                className={buttonStyles({
                  variant: "secondary",
                  className: "justify-center",
                })}
              >
                {dictionary.cookieConsent.allowAll}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6">
          <section className="mx-auto max-w-[90rem] rounded-hero border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-2xl sm:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-eyebrow app-soft">
                  {dictionary.cookieConsent.badge}
                </p>
                <h2 className="font-display mt-3 text-2xl font-medium tracking-tight text-[color:var(--foreground)]">
                  {dictionary.cookieConsent.title}
                </h2>
                <p className="mt-3 text-sm leading-7 app-muted sm:text-base">
                  {dictionary.cookieConsent.description}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full border border-[color:var(--border)] px-3 py-1.5 app-soft">
                    {dictionary.cookieConsent.essentialSummary}
                  </span>
                  <LocalizedLink
                    href="/cookies"
                    className="font-medium text-[color:var(--foreground)] underline decoration-[color:var(--border)] underline-offset-4"
                  >
                    {dictionary.cookieConsent.learnMore}
                  </LocalizedLink>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[26rem] xl:grid-cols-2">
                <button
                  type="button"
                  onClick={() => applyConsent(buildEssentialOnlyConsent())}
                  className={buttonStyles({
                    variant: "secondary",
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
                    className: "justify-center",
                  })}
                >
                  {dictionary.cookieConsent.allowAll}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
