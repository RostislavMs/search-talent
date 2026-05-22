import { describe, expect, it } from "vitest";
import { markNotificationsReadSchema } from "@/lib/validation/notifications";

const uuid = "9c8b6f3a-4f2a-4f9b-89f1-1234567890ab";

describe("markNotificationsReadSchema", () => {
  it("accepts { all: true } with no ids", () => {
    const parsed = markNotificationsReadSchema.safeParse({ all: true });
    expect(parsed.success).toBe(true);
  });

  it("accepts a non-empty ids array", () => {
    const parsed = markNotificationsReadSchema.safeParse({ ids: [uuid] });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty body (no ids, no all)", () => {
    const parsed = markNotificationsReadSchema.safeParse({});
    expect(parsed.success).toBe(false);
  });

  it("rejects empty ids without all flag", () => {
    const parsed = markNotificationsReadSchema.safeParse({ ids: [] });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-uuid ids", () => {
    const parsed = markNotificationsReadSchema.safeParse({ ids: ["nope"] });
    expect(parsed.success).toBe(false);
  });

  it("rejects more than 200 ids", () => {
    const parsed = markNotificationsReadSchema.safeParse({
      ids: Array.from({ length: 201 }, () => uuid),
    });
    expect(parsed.success).toBe(false);
  });
});
