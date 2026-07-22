import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextResponse } from "next/server";
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
} from "@/lib/security/headers";

// Parse a CSP string into { directive: [values] }.
function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(";").map((p) => p.trim()).filter(Boolean)) {
    const [name, ...values] = part.split(/\s+/);
    out[name] = values;
  }
  return out;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildContentSecurityPolicy — hardening invariants", () => {
  it("locks framing and plugins down", () => {
    const csp = parseCsp(buildContentSecurityPolicy());
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["default-src"]).toEqual(["'self'"]);
  });

  it("never allows a bare wildcard or wildcard scheme in script-src", () => {
    const csp = parseCsp(buildContentSecurityPolicy());
    expect(csp["script-src"]).toContain("'self'");
    expect(csp["script-src"]).not.toContain("*");
    // A bare `https:` would allow scripts from any HTTPS host.
    expect(csp["script-src"]).not.toContain("https:");
  });
});

describe("buildContentSecurityPolicy — env-derived origins", () => {
  it("whitelists the Supabase origin (http + wss) when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    const csp = parseCsp(buildContentSecurityPolicy());
    expect(csp["connect-src"]).toContain("https://abc.supabase.co");
    expect(csp["connect-src"]).toContain("wss://abc.supabase.co");
    expect(csp["img-src"]).toContain("https://abc.supabase.co");
  });

  it("omits Supabase hosts when the env var is unset or invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const csp = parseCsp(buildContentSecurityPolicy());
    expect(csp["connect-src"].some((v) => v.includes("supabase"))).toBe(false);
  });
});

describe("buildContentSecurityPolicy — production upgrade", () => {
  it("adds upgrade-insecure-requests only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(buildContentSecurityPolicy()).toContain("upgrade-insecure-requests");

    vi.stubEnv("NODE_ENV", "development");
    expect(buildContentSecurityPolicy()).not.toContain("upgrade-insecure-requests");
  });
});

describe("applySecurityHeaders", () => {
  function fakeResponse() {
    return { headers: new Headers() } as unknown as NextResponse;
  }

  it("sets the core hardening headers", () => {
    const res = applySecurityHeaders(fakeResponse());
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(res.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("sets HSTS only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      applySecurityHeaders(fakeResponse()).headers.get("Strict-Transport-Security"),
    ).toContain("max-age=");

    vi.stubEnv("NODE_ENV", "test");
    expect(
      applySecurityHeaders(fakeResponse()).headers.get("Strict-Transport-Security"),
    ).toBeNull();
  });
});
