import { describe, expect, it } from "vitest";
import {
  popupCreateSchema,
  popupInputToRow,
  popupUpdateSchema,
} from "@/lib/validation/popup";

describe("popupCreateSchema", () => {
  it("accepts a minimal feedback popup and applies defaults", () => {
    const parsed = popupCreateSchema.parse({ kind: "feedback" });
    expect(parsed.isActive).toBe(false);
    expect(parsed.delaySeconds).toBe(5);
    expect(parsed.titleEn).toBe("");
    expect(parsed.ctaHref).toBe("");
  });

  it("rejects an unknown kind", () => {
    expect(popupCreateSchema.safeParse({ kind: "banner" }).success).toBe(false);
  });

  it("accepts a relative path or https URL as the CTA link", () => {
    expect(
      popupCreateSchema.safeParse({ kind: "message", ctaHref: "/articles" })
        .success,
    ).toBe(true);
    expect(
      popupCreateSchema.safeParse({
        kind: "message",
        ctaHref: "https://example.com",
      }).success,
    ).toBe(true);
  });

  it("rejects an unsafe javascript: CTA link", () => {
    expect(
      popupCreateSchema.safeParse({
        kind: "message",
        ctaHref: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("rejects a delay outside 0–600", () => {
    expect(
      popupCreateSchema.safeParse({ kind: "feedback", delaySeconds: 601 })
        .success,
    ).toBe(false);
    expect(
      popupCreateSchema.safeParse({ kind: "feedback", delaySeconds: -1 })
        .success,
    ).toBe(false);
  });

  it("rejects an over-long title", () => {
    expect(
      popupCreateSchema.safeParse({ kind: "message", titleEn: "x".repeat(201) })
        .success,
    ).toBe(false);
  });
});

describe("popupUpdateSchema", () => {
  it("allows a partial update", () => {
    expect(popupUpdateSchema.safeParse({ isActive: true }).success).toBe(true);
  });

  it("rejects unknown keys (strict)", () => {
    expect(popupUpdateSchema.safeParse({ bogus: 1 }).success).toBe(false);
  });
});

describe("popupInputToRow", () => {
  it("maps camelCase fields to snake_case columns", () => {
    const row = popupInputToRow({
      kind: "message",
      isActive: true,
      titleEn: "Hello",
      delaySeconds: 10,
    });
    expect(row).toMatchObject({
      kind: "message",
      is_active: true,
      title_en: "Hello",
      delay_seconds: 10,
    });
  });

  it("converts empty strings to null", () => {
    const row = popupInputToRow({ titleEn: "", ctaHref: "" });
    expect(row.title_en).toBeNull();
    expect(row.cta_href).toBeNull();
  });

  it("omits fields that were not provided", () => {
    const row = popupInputToRow({ isActive: false });
    expect(Object.keys(row)).toEqual(["is_active"]);
  });
});
