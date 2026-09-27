import { describe, expect, it } from "vitest";
import {
  buildAuthCallbackUrl,
  buildContinueHref,
  buildLoginHref,
  buildSignupHref,
  getLocaleOfPath,
  resolvePostAuthPath,
  sanitizeNextPath,
} from "@/lib/auth/redirect";

describe("sanitizeNextPath", () => {
  it("keeps internal page paths and adds the locale when missing", () => {
    expect(sanitizeNextPath("/projects/new", "uk")).toBe("/uk/projects/new");
    expect(sanitizeNextPath("/en/u/olena", "uk")).toBe("/en/u/olena");
    expect(sanitizeNextPath("/", "en")).toBe("/en");
  });

  it("keeps the query string and hash", () => {
    expect(sanitizeNextPath("/projects/new?kind=code&step=2#top", "uk")).toBe(
      "/uk/projects/new?kind=code&step=2#top",
    );
  });

  it.each([
    ["absolute URL", "https://evil.com/steal"],
    ["protocol-relative URL", "//evil.com"],
    ["backslash trick", "/\\evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative path", "projects"],
    ["control characters", "/uk/\nprojects"],
    ["empty string", "   "],
  ])("rejects a %s", (_label, value) => {
    expect(sanitizeNextPath(value, "uk")).toBeNull();
  });

  it("rejects non-strings and very long values", () => {
    expect(sanitizeNextPath(null)).toBeNull();
    expect(sanitizeNextPath(42)).toBeNull();
    expect(sanitizeNextPath(`/${"a".repeat(600)}`)).toBeNull();
  });

  it("rejects API routes, also when hidden behind dot segments", () => {
    expect(sanitizeNextPath("/api/auth/logout")).toBeNull();
    expect(sanitizeNextPath("/uk/../api/profile/delete/confirm")).toBeNull();
  });

  it("rejects the auth screens so signing in cannot loop", () => {
    expect(sanitizeNextPath("/uk/login")).toBeNull();
    expect(sanitizeNextPath("/signup?next=/uk")).toBeNull();
    expect(sanitizeNextPath("/en/verify")).toBeNull();
    expect(sanitizeNextPath("/uk/reset-password")).toBeNull();
  });
});

describe("getLocaleOfPath", () => {
  it("reads the locale prefix, falling back when there is none", () => {
    expect(getLocaleOfPath("/en/my-space", "uk")).toBe("en");
    expect(getLocaleOfPath("/projects", "uk")).toBe("uk");
    expect(getLocaleOfPath(null, "en")).toBe("en");
  });
});

describe("resolvePostAuthPath", () => {
  it("prefers the page the person was heading to", () => {
    expect(
      resolvePostAuthPath({ next: "/en/projects/1", locale: "uk", needsOnboarding: true }),
    ).toBe("/en/projects/1");
  });

  it("sends newcomers to the onboarding and everyone else to My Space", () => {
    expect(resolvePostAuthPath({ next: null, locale: "uk", needsOnboarding: true })).toBe(
      "/uk/onboarding",
    );
    expect(resolvePostAuthPath({ next: null, locale: "en", needsOnboarding: false })).toBe(
      "/en/my-space",
    );
  });
});

describe("login and sign-up links", () => {
  it("adds an encoded next only when it is safe", () => {
    expect(buildLoginHref("uk", "/projects/new?kind=code")).toBe(
      "/uk/login?next=%2Fuk%2Fprojects%2Fnew%3Fkind%3Dcode",
    );
    expect(buildLoginHref("en", "https://evil.com")).toBe("/en/login");
    expect(buildLoginHref("uk")).toBe("/uk/login");
    expect(buildSignupHref("en", "/en/u/olena")).toBe("/en/signup?next=%2Fen%2Fu%2Folena");
    expect(buildSignupHref("uk", null)).toBe("/uk/signup");
  });

  it("points the password login at the continue route", () => {
    expect(buildContinueHref("uk")).toBe("/api/auth/continue?locale=uk");
    expect(buildContinueHref("en", "/my-space/saved")).toBe(
      "/api/auth/continue?locale=en&next=%2Fen%2Fmy-space%2Fsaved",
    );
    expect(buildContinueHref("uk", "//evil.com")).toBe("/api/auth/continue?locale=uk");
  });
});

describe("buildAuthCallbackUrl", () => {
  it("builds the callback on the given origin", () => {
    expect(buildAuthCallbackUrl("https://searchtalent.dev")).toBe(
      "https://searchtalent.dev/api/auth/callback",
    );
  });

  it("carries next, flow and locale", () => {
    const url = new URL(
      buildAuthCallbackUrl("https://searchtalent.dev", {
        next: "/uk/projects/new",
        flow: "signup",
        locale: "uk",
      }),
    );
    expect(url.pathname).toBe("/api/auth/callback");
    expect(url.searchParams.get("next")).toBe("/uk/projects/new");
    expect(url.searchParams.get("flow")).toBe("signup");
    expect(url.searchParams.get("locale")).toBe("uk");
  });
});
