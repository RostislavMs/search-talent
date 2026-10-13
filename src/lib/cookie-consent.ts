export const cookieConsentCookieName = "st_cookie_consent";
export const cookieConsentUpdatedEvent = "searchtalent:cookie-consent-updated";
export const cookieConsentOpenEvent = "searchtalent:cookie-consent-open";
export const cookieConsentVersion = 1;
export const cookieConsentMaxAge = 60 * 60 * 24 * 180;

export const consentCategories = [
  "essential",
  "preferences",
  "analytics",
  "marketing",
] as const;

export type ConsentCategory = (typeof consentCategories)[number];

const consentStatuses = ["essential", "limited", "all", "custom"] as const;

export type CookieConsent = {
  version: typeof cookieConsentVersion;
  status: (typeof consentStatuses)[number];
  updatedAt: string;
  categories: {
    essential: true;
    preferences: boolean;
    analytics: boolean;
    marketing: boolean;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checked by hand rather than with zod: this module runs in the browser on
 * every page, and zod alone would add about 60KB of JavaScript to each of them.
 * Unknown keys are dropped, as a zod object would.
 */
function toCookieConsent(value: unknown): CookieConsent | null {
  if (!isRecord(value) || !isRecord(value.categories)) {
    return null;
  }

  const { version, status, updatedAt, categories } = value;
  const { essential, preferences, analytics, marketing } = categories;

  if (
    version !== cookieConsentVersion ||
    !consentStatuses.some((known) => known === status) ||
    typeof updatedAt !== "string" ||
    essential !== true ||
    typeof preferences !== "boolean" ||
    typeof analytics !== "boolean" ||
    typeof marketing !== "boolean"
  ) {
    return null;
  }

  return {
    version,
    status: status as CookieConsent["status"],
    updatedAt,
    categories: { essential, preferences, analytics, marketing },
  };
}

type OptionalConsentCategories = Pick<
  CookieConsent["categories"],
  "preferences" | "analytics" | "marketing"
>;

function resolveConsentStatus(
  categories: CookieConsent["categories"],
): CookieConsent["status"] {
  if (
    !categories.preferences &&
    !categories.analytics &&
    !categories.marketing
  ) {
    return "essential";
  }

  if (
    categories.preferences &&
    !categories.analytics &&
    !categories.marketing
  ) {
    return "limited";
  }

  if (
    categories.preferences &&
    categories.analytics &&
    categories.marketing
  ) {
    return "all";
  }

  return "custom";
}

export function buildCookieConsent(
  categories: Partial<OptionalConsentCategories> = {},
): CookieConsent {
  const nextCategories: CookieConsent["categories"] = {
    essential: true,
    preferences: categories.preferences ?? false,
    analytics: categories.analytics ?? false,
    marketing: categories.marketing ?? false,
  };

  return {
    version: cookieConsentVersion,
    status: resolveConsentStatus(nextCategories),
    updatedAt: new Date().toISOString(),
    categories: nextCategories,
  };
}

export function buildEssentialOnlyConsent() {
  return buildCookieConsent();
}

export function buildLimitedConsent() {
  return buildCookieConsent({ preferences: true });
}

export function buildAllowAllConsent() {
  return buildCookieConsent({
    preferences: true,
    analytics: true,
    marketing: true,
  });
}

export function parseCookieConsentValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(value);
    return toCookieConsent(JSON.parse(decoded));
  } catch {
    return null;
  }
}

export function serializeCookieConsent(consent: CookieConsent) {
  return JSON.stringify(consent);
}

export function allowsCookieCategory(
  consent: CookieConsent | null,
  category: ConsentCategory,
) {
  if (category === "essential") {
    return true;
  }

  return consent?.categories[category] === true;
}

function getClientCookieValue(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`),
  );

  return match ? match[1] : null;
}

function buildClientCookieAttributes(maxAge: number) {
  if (typeof window === "undefined") {
    return `path=/; max-age=${maxAge}; samesite=lax`;
  }

  return [
    "path=/",
    `max-age=${maxAge}`,
    "samesite=lax",
    window.location.protocol === "https:" ? "secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function getCookieConsentFromDocument() {
  return parseCookieConsentValue(getClientCookieValue(cookieConsentCookieName));
}

export function persistCookieConsent(consent: CookieConsent) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${cookieConsentCookieName}=${encodeURIComponent(
    serializeCookieConsent(consent),
  )}; ${buildClientCookieAttributes(cookieConsentMaxAge)}`;
}

export function emitCookieConsentUpdated(consent: CookieConsent) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(cookieConsentUpdatedEvent, {
      detail: consent,
    }),
  );
}

export function requestCookieConsentPreferences() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(cookieConsentOpenEvent));
}
