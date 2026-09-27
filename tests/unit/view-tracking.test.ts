import { describe, expect, it } from "vitest";
import {
  buildVisitorSeed,
  classifyReferrer,
  getClientIp,
  isLikelyBot,
  normalizeHost,
  resolveBeaconReferrer,
  viewBeaconSchema,
} from "@/lib/view-tracking";

const ID = "22222222-2222-4222-8222-222222222222";
const SITE = ["searchtalent.com.ua", "localhost:3000"];

describe("normalizeHost", () => {
  it("drops port, www and trailing dot, lower-cases", () => {
    expect(normalizeHost("WWW.LinkedIn.com.")).toBe("linkedin.com");
    expect(normalizeHost("localhost:3000")).toBe("localhost");
  });

  it("returns null for empty values", () => {
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost(null)).toBeNull();
    expect(normalizeHost("   ")).toBeNull();
  });
});

describe("classifyReferrer", () => {
  it("treats a missing or unreadable referrer as direct", () => {
    expect(classifyReferrer("", SITE)).toEqual({ source: "direct", referrerHost: null });
    expect(classifyReferrer(null, SITE)).toEqual({ source: "direct", referrerHost: null });
    expect(classifyReferrer("not a url", SITE)).toEqual({
      source: "direct",
      referrerHost: null,
    });
  });

  it("treats the site's own hosts as internal and keeps no host", () => {
    expect(classifyReferrer("https://www.searchtalent.com.ua/uk/talents", SITE)).toEqual({
      source: "internal",
      referrerHost: null,
    });
    expect(classifyReferrer("http://localhost:3000/uk", SITE).source).toBe("internal");
  });

  it("keeps only the host of another site, never the path or query", () => {
    expect(
      classifyReferrer("https://www.linkedin.com/feed/?q=secret", SITE),
    ).toEqual({ source: "external", referrerHost: "linkedin.com" });
  });

  it("understands app referrers such as Telegram on Android", () => {
    expect(classifyReferrer("android-app://org.telegram.messenger/", SITE)).toEqual({
      source: "external",
      referrerHost: "org.telegram.messenger",
    });
  });
});

describe("resolveBeaconReferrer", () => {
  it("uses document.referrer on the page the browser loaded", () => {
    expect(
      resolveBeaconReferrer({
        navigationUrl: "https://searchtalent.com.ua/uk/u/ada?utm_source=cv",
        currentUrl: "https://searchtalent.com.ua/uk/u/ada",
        documentReferrer: "https://www.linkedin.com/",
      }),
    ).toBe("https://www.linkedin.com/");
  });

  it("reports the site itself after a client-side navigation", () => {
    expect(
      resolveBeaconReferrer({
        navigationUrl: "https://searchtalent.com.ua/uk/u/ada",
        currentUrl: "https://searchtalent.com.ua/uk/projects/demo",
        documentReferrer: "https://www.linkedin.com/",
      }),
    ).toBe("https://searchtalent.com.ua/");
  });

  it("falls back to document.referrer without a navigation entry", () => {
    expect(
      resolveBeaconReferrer({
        navigationUrl: null,
        currentUrl: "https://searchtalent.com.ua/uk/u/ada",
        documentReferrer: "",
      }),
    ).toBe("");
  });
});

describe("isLikelyBot", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "TelegramBot (like TwitterBot)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0",
    "curl/8.4.0",
    "python-requests/2.31",
    "",
  ])("flags %s", (userAgent) => {
    expect(isLikelyBot(userAgent)).toBe(true);
  });

  it.each([
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/11.0",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36 [LinkedInApp]",
  ])("lets people through: %s", (userAgent) => {
    expect(isLikelyBot(userAgent)).toBe(false);
  });
});

describe("buildVisitorSeed", () => {
  it("recognises a signed-in viewer by account", () => {
    expect(buildVisitorSeed({ userId: "u1", ip: "1.2.3.4", userAgent: "UA" })).toBe("u:u1");
  });

  it("recognises a guest by IP and user agent", () => {
    expect(buildVisitorSeed({ userId: null, ip: "1.2.3.4", userAgent: "UA" })).toBe(
      "a:1.2.3.4|UA",
    );
  });
});

describe("getClientIp", () => {
  it("takes the first forwarded address", () => {
    const headers = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(getClientIp(new Headers())).toBeNull();
  });
});

describe("viewBeaconSchema", () => {
  it("accepts the three page types", () => {
    for (const targetType of ["profile", "project", "article"]) {
      expect(
        viewBeaconSchema.safeParse({ targetType, targetId: ID, referrer: "" }).success,
      ).toBe(true);
    }
  });

  it("rejects unknown types, bad ids and oversized referrers", () => {
    expect(viewBeaconSchema.safeParse({ targetType: "poll", targetId: ID }).success).toBe(false);
    expect(
      viewBeaconSchema.safeParse({ targetType: "project", targetId: "nope" }).success,
    ).toBe(false);
    expect(
      viewBeaconSchema.safeParse({
        targetType: "project",
        targetId: ID,
        referrer: `https://x.com/${"a".repeat(2100)}`,
      }).success,
    ).toBe(false);
  });
});
