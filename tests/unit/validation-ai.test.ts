import { describe, expect, it } from "vitest";
import { githubDraftPayloadSchema } from "@/lib/validation/ai";

const baseBody = {
  fullName: "alice/awesome",
};

describe("githubDraftPayloadSchema", () => {
  it("accepts a minimal valid body", () => {
    const parsed = githubDraftPayloadSchema.safeParse(baseBody);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.fullName).toBe("alice/awesome");
      expect(parsed.data.locale).toBe("en");
      expect(parsed.data.existing).toEqual({});
    }
  });

  it("rejects an invalid fullName", () => {
    const parsed = githubDraftPayloadSchema.safeParse({
      ...baseBody,
      fullName: "no-slash",
    });
    expect(parsed.success).toBe(false);
  });

  it("falls back to en for unknown locale", () => {
    const parsed = githubDraftPayloadSchema.safeParse({
      ...baseBody,
      locale: "fr",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.locale).toBe("en");
  });

  it("accepts valid locales", () => {
    const parsed = githubDraftPayloadSchema.safeParse({
      ...baseBody,
      locale: "uk",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.locale).toBe("uk");
  });

  it("accepts existing fields with role normalization", () => {
    const parsed = githubDraftPayloadSchema.safeParse({
      ...baseBody,
      existing: {
        role: "maintainer",
        contribution: "built X",
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.existing.role).toBe("maintainer");
      expect(parsed.data.existing.contribution).toBe("built X");
    }
  });

  it("normalizes empty role to null", () => {
    const parsed = githubDraftPayloadSchema.safeParse({
      ...baseBody,
      existing: { role: "" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.existing.role).toBeNull();
  });

  it("rejects an over-long contribution field", () => {
    const parsed = githubDraftPayloadSchema.safeParse({
      ...baseBody,
      existing: { contribution: "x".repeat(2001) },
    });
    expect(parsed.success).toBe(false);
  });
});
