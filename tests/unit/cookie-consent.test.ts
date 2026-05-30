import { describe, expect, it } from "vitest";
import {
  allowsCookieCategory,
  buildAllowAllConsent,
  buildCookieConsent,
  buildEssentialOnlyConsent,
  buildLimitedConsent,
  cookieConsentVersion,
  parseCookieConsentValue,
  serializeCookieConsent,
} from "@/lib/cookie-consent";

describe("buildCookieConsent", () => {
  it("returns essential-only consent by default", () => {
    const consent = buildCookieConsent();

    expect(consent.version).toBe(cookieConsentVersion);
    expect(consent.status).toBe("essential");
    expect(consent.categories).toEqual({
      essential: true,
      preferences: false,
      analytics: false,
      marketing: false,
    });
    expect(() => new Date(consent.updatedAt).toISOString()).not.toThrow();
  });

  it("marks status as limited when only preferences are enabled", () => {
    const consent = buildLimitedConsent();

    expect(consent.status).toBe("limited");
    expect(consent.categories.preferences).toBe(true);
    expect(consent.categories.analytics).toBe(false);
    expect(consent.categories.marketing).toBe(false);
  });

  it("marks status as all when every category is enabled", () => {
    const consent = buildAllowAllConsent();

    expect(consent.status).toBe("all");
    expect(consent.categories).toEqual({
      essential: true,
      preferences: true,
      analytics: true,
      marketing: true,
    });
  });

  it("marks status as custom for non-standard combinations", () => {
    const consent = buildCookieConsent({ analytics: true });

    expect(consent.status).toBe("custom");
    expect(consent.categories.analytics).toBe(true);
    expect(consent.categories.preferences).toBe(false);
  });

  it("essential is always true regardless of input", () => {
    const consent = buildEssentialOnlyConsent();
    expect(consent.categories.essential).toBe(true);
  });
});

describe("parseCookieConsentValue", () => {
  it("returns null for missing values", () => {
    expect(parseCookieConsentValue(null)).toBeNull();
    expect(parseCookieConsentValue(undefined)).toBeNull();
    expect(parseCookieConsentValue("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseCookieConsentValue("not-json")).toBeNull();
  });

  it("returns null when schema validation fails", () => {
    const invalid = encodeURIComponent(
      JSON.stringify({ version: 999, status: "all" }),
    );
    expect(parseCookieConsentValue(invalid)).toBeNull();
  });

  it("parses a valid URL-encoded consent payload", () => {
    const consent = buildAllowAllConsent();
    const encoded = encodeURIComponent(serializeCookieConsent(consent));

    expect(parseCookieConsentValue(encoded)).toEqual(consent);
  });
});

describe("allowsCookieCategory", () => {
  it("always allows essential category, even without consent", () => {
    expect(allowsCookieCategory(null, "essential")).toBe(true);
  });

  it("denies non-essential categories when there is no consent", () => {
    expect(allowsCookieCategory(null, "analytics")).toBe(false);
    expect(allowsCookieCategory(null, "marketing")).toBe(false);
    expect(allowsCookieCategory(null, "preferences")).toBe(false);
  });

  it("reflects consent state for individual categories", () => {
    const consent = buildCookieConsent({ analytics: true });

    expect(allowsCookieCategory(consent, "analytics")).toBe(true);
    expect(allowsCookieCategory(consent, "marketing")).toBe(false);
  });
});

describe("serializeCookieConsent", () => {
  it("returns a valid JSON string", () => {
    const consent = buildAllowAllConsent();
    const result = serializeCookieConsent(consent);

    expect(typeof result).toBe("string");
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("round-trips through serialize and parse", () => {
    const consent = buildCookieConsent({ analytics: true, marketing: true });
    const serialized = serializeCookieConsent(consent);
    const encoded = encodeURIComponent(serialized);

    expect(parseCookieConsentValue(encoded)).toEqual(consent);
  });
});

