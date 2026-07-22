import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "@/lib/format-relative-time";

const NOW = new Date("2026-07-22T12:00:00.000Z");

// Build an ISO string a given number of ms before the frozen "now".
function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatRelativeTime", () => {
  it("returns 'just now' under a minute (both locales)", () => {
    expect(formatRelativeTime(ago(30_000), "uk")).toBe("щойно");
    expect(formatRelativeTime(ago(30_000), "en")).toBe("just now");
  });

  it("returns minutes under an hour", () => {
    expect(formatRelativeTime(ago(5 * MIN), "uk")).toBe("5 хв тому");
    expect(formatRelativeTime(ago(5 * MIN), "en")).toBe("5m ago");
  });

  it("returns hours under a day", () => {
    expect(formatRelativeTime(ago(3 * HOUR), "uk")).toBe("3 год тому");
    expect(formatRelativeTime(ago(3 * HOUR), "en")).toBe("3h ago");
  });

  it("returns days under 30 days", () => {
    expect(formatRelativeTime(ago(4 * DAY), "uk")).toBe("4 дн тому");
    expect(formatRelativeTime(ago(4 * DAY), "en")).toBe("4d ago");
  });

  it("falls back to an absolute medium date at/after 30 days", () => {
    const uk = formatRelativeTime(ago(31 * DAY), "uk");
    const en = formatRelativeTime(ago(31 * DAY), "en");
    // Absolute format, not the relative wording.
    expect(uk).not.toContain("тому");
    expect(en).not.toContain("ago");
    // 31 days before 2026-07-22 is 2026-06-21.
    expect(en).toMatch(/Jun/);
  });

  it("treats a locale other than 'uk' as English", () => {
    expect(formatRelativeTime(ago(2 * MIN), "fr")).toBe("2m ago");
  });

  it("uses the exact boundary at 60 minutes as hours", () => {
    expect(formatRelativeTime(ago(HOUR), "en")).toBe("1h ago");
  });
});
