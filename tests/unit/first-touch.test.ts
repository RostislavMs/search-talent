import { describe, expect, it } from "vitest";
import {
  buildFirstTouch,
  parseFirstTouch,
  serializeFirstTouch,
  signupSourceSchema,
  toSignupSourcePayload,
} from "@/lib/first-touch";

const NOW = Date.parse("2026-09-26T12:00:00Z");

describe("buildFirstTouch", () => {
  it("keeps the referring host, UTM tags and the landing path only", () => {
    const touch = buildFirstTouch({
      landingUrl:
        "https://searchtalent.com.ua/uk/u/ada?utm_source=LinkedIn&utm_medium=Social&utm_campaign=Pilot%20KPI&token=secret",
      documentReferrer: "https://www.linkedin.com/feed/?q=private",
      now: NOW,
    });

    expect(touch).toEqual({
      v: 1,
      referrerHost: "linkedin.com",
      utmSource: "linkedin",
      utmMedium: "social",
      utmCampaign: "Pilot KPI",
      landingPath: "/uk/u/ada",
      firstSeenAt: NOW,
      sent: false,
    });
  });

  it("does not treat the site itself as a source", () => {
    const touch = buildFirstTouch({
      landingUrl: "https://searchtalent.com.ua/uk",
      documentReferrer: "https://www.searchtalent.com.ua/en",
      now: NOW,
    });
    expect(touch?.referrerHost).toBeNull();
  });

  it("records a direct visit with every field empty", () => {
    const touch = buildFirstTouch({
      landingUrl: "https://searchtalent.com.ua/uk",
      documentReferrer: "",
      now: NOW,
    });
    expect(touch).toMatchObject({
      referrerHost: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
    });
  });

  it("returns null for an unreadable landing URL", () => {
    expect(buildFirstTouch({ landingUrl: "nope", documentReferrer: "", now: NOW })).toBeNull();
  });
});

describe("parseFirstTouch", () => {
  it("round-trips a stored value", () => {
    const touch = buildFirstTouch({
      landingUrl: "https://searchtalent.com.ua/uk",
      documentReferrer: "https://t.me/",
      now: NOW,
    })!;
    expect(parseFirstTouch(serializeFirstTouch(touch))).toEqual(touch);
  });

  it("ignores missing, malformed or foreign values", () => {
    expect(parseFirstTouch(null)).toBeNull();
    expect(parseFirstTouch("{not json")).toBeNull();
    expect(parseFirstTouch(JSON.stringify({ v: 2 }))).toBeNull();
  });
});

describe("toSignupSourcePayload", () => {
  it("sends the age on the browser's clock instead of a timestamp", () => {
    const touch = buildFirstTouch({
      landingUrl: "https://searchtalent.com.ua/uk",
      documentReferrer: "",
      now: NOW,
    })!;
    const payload = toSignupSourcePayload(touch, NOW + 90_500);

    expect(payload.firstSeenAgeSeconds).toBe(90);
    expect(signupSourceSchema.safeParse(payload).success).toBe(true);
  });

  it("never sends a negative age", () => {
    const touch = buildFirstTouch({
      landingUrl: "https://searchtalent.com.ua/uk",
      documentReferrer: "",
      now: NOW,
    })!;
    expect(toSignupSourcePayload(touch, NOW - 5_000).firstSeenAgeSeconds).toBe(0);
  });
});
