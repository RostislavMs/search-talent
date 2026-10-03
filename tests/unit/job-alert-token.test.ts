import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildJobAlertOneClickUrl,
  buildJobAlertUnsubscribePageUrl,
  isValidJobAlertUnsubscribeToken,
  jobAlertUnsubscribeToken,
} from "@/lib/job-alert-token";

const USER = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-secret");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://searchtalent.example");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("job alert unsubscribe token", () => {
  it("is a stable HMAC of the person, case-insensitive on the id", () => {
    const token = jobAlertUnsubscribeToken(USER);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(jobAlertUnsubscribeToken(USER.toUpperCase())).toBe(token);
    expect(jobAlertUnsubscribeToken(OTHER)).not.toBe(token);
  });

  it("checks out only for its own person", () => {
    const token = jobAlertUnsubscribeToken(USER)!;
    expect(isValidJobAlertUnsubscribeToken(USER, token)).toBe(true);
    expect(isValidJobAlertUnsubscribeToken(OTHER, token)).toBe(false);
    expect(isValidJobAlertUnsubscribeToken(USER, token.replace(/.$/, (c) => (c === "0" ? "1" : "0")))).toBe(false);
  });

  it("refuses anything malformed", () => {
    const token = jobAlertUnsubscribeToken(USER)!;
    expect(isValidJobAlertUnsubscribeToken("not-a-uuid", token)).toBe(false);
    expect(isValidJobAlertUnsubscribeToken(USER, token.slice(1))).toBe(false);
    expect(isValidJobAlertUnsubscribeToken(USER, token.toUpperCase())).toBe(false);
    expect(isValidJobAlertUnsubscribeToken(null, token)).toBe(false);
    expect(isValidJobAlertUnsubscribeToken(USER, undefined)).toBe(false);
  });

  it("depends on the key: a token from another key fails", () => {
    const token = jobAlertUnsubscribeToken(USER)!;
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "rotated");
    expect(isValidJobAlertUnsubscribeToken(USER, token)).toBe(false);
  });

  it("makes nothing without the service key", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(jobAlertUnsubscribeToken(USER)).toBeNull();
    expect(isValidJobAlertUnsubscribeToken(USER, "a".repeat(64))).toBe(false);
    expect(buildJobAlertUnsubscribePageUrl("uk", USER)).toBeNull();
    expect(buildJobAlertOneClickUrl(USER)).toBeNull();
  });

  it("builds the page and the one-click addresses", () => {
    const token = jobAlertUnsubscribeToken(USER)!;
    const page = new URL(buildJobAlertUnsubscribePageUrl("uk", USER)!);
    expect(page.pathname).toBe("/uk/job-alerts/unsubscribe");
    expect(page.searchParams.get("u")).toBe(USER);
    expect(page.searchParams.get("t")).toBe(token);

    const oneClick = new URL(buildJobAlertOneClickUrl(USER)!);
    expect(oneClick.pathname).toBe("/api/job-alerts/unsubscribe");
    expect(oneClick.searchParams.get("t")).toBe(token);
  });
});
