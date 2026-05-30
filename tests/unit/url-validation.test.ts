import { describe, expect, it } from "vitest";
import { isValidPublicUrl } from "@/lib/url-validation";

describe("isValidPublicUrl", () => {
  it("accepts http and https URLs with a domain", () => {
    expect(isValidPublicUrl("https://example.com")).toBe(true);
    expect(isValidPublicUrl("http://example.com/path?q=1")).toBe(true);
    expect(isValidPublicUrl("https://sub.domain.example.co.uk/foo")).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidPublicUrl("  https://example.com  ")).toBe(true);
  });

  it("rejects empty, missing, or non-string input", () => {
    expect(isValidPublicUrl("")).toBe(false);
    expect(isValidPublicUrl("   ")).toBe(false);
    expect(isValidPublicUrl(null as unknown as string)).toBe(false);
    expect(isValidPublicUrl(undefined as unknown as string)).toBe(false);
  });

  it("rejects URLs without a TLD-style hostname", () => {
    expect(isValidPublicUrl("http://abc")).toBe(false);
    expect(isValidPublicUrl("https://localhost")).toBe(false);
  });

  it("rejects malformed input and non-http(s) protocols", () => {
    expect(isValidPublicUrl("not a url")).toBe(false);
    expect(isValidPublicUrl("example.com")).toBe(false);
    expect(isValidPublicUrl("javascript:alert(1)")).toBe(false);
    expect(isValidPublicUrl("ftp://example.com")).toBe(false);
  });

  it("rejects URLs longer than 2048 characters", () => {
    const long = `https://example.com/${"a".repeat(2048)}`;
    expect(isValidPublicUrl(long)).toBe(false);
  });
});
