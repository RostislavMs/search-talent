import { describe, expect, it } from "vitest";
import {
  moderationUpdateSchema,
  reportPayloadSchema,
} from "@/lib/validation/report";

const uuid = "9c8b6f3a-4f2a-4f9b-89f1-1234567890ab";

describe("reportPayloadSchema", () => {
  it("accepts a valid report", () => {
    const result = reportPayloadSchema.safeParse({
      targetType: "profile",
      targetId: uuid,
      reason: "spam_or_scam",
      details: "some details",
    });
    expect(result.success).toBe(true);
  });

  it("defaults missing details to empty string", () => {
    const result = reportPayloadSchema.safeParse({
      targetType: "project",
      targetId: uuid,
      reason: "other",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.details).toBe("");
    }
  });

  it("rejects unknown targetType / reason", () => {
    expect(
      reportPayloadSchema.safeParse({
        targetType: "user",
        targetId: uuid,
        reason: "other",
      }).success,
    ).toBe(false);

    expect(
      reportPayloadSchema.safeParse({
        targetType: "profile",
        targetId: uuid,
        reason: "bogus",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid UUID", () => {
    expect(
      reportPayloadSchema.safeParse({
        targetType: "profile",
        targetId: "no",
        reason: "other",
      }).success,
    ).toBe(false);
  });

  it("rejects details over 1200 chars", () => {
    expect(
      reportPayloadSchema.safeParse({
        targetType: "profile",
        targetId: uuid,
        reason: "other",
        details: "x".repeat(1201),
      }).success,
    ).toBe(false);
  });
});

describe("moderationUpdateSchema", () => {
  it("accepts a minimal payload", () => {
    const result = moderationUpdateSchema.safeParse({
      targetType: "article",
      targetId: uuid,
      moderationStatus: "approved",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resolutionNote).toBe("");
    }
  });

  it("accepts optional report fields", () => {
    expect(
      moderationUpdateSchema.safeParse({
        targetType: "article",
        targetId: uuid,
        moderationStatus: "removed",
        reportId: uuid,
        reportStatus: "resolved",
        resolutionNote: "policy violation",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown moderation status", () => {
    expect(
      moderationUpdateSchema.safeParse({
        targetType: "article",
        targetId: uuid,
        moderationStatus: "spammy",
      }).success,
    ).toBe(false);
  });
});
