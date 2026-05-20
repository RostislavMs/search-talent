import { describe, expect, it } from "vitest";
import { profileVoteSchema, projectVoteSchema } from "@/lib/validation/vote";

const validUuid = "9c8b6f3a-4f2a-4f9b-89f1-1234567890ab";

describe("projectVoteSchema", () => {
  it("accepts +1 and -1 values with a valid UUID", () => {
    expect(projectVoteSchema.safeParse({ projectId: validUuid, value: 1 }).success)
      .toBe(true);
    expect(projectVoteSchema.safeParse({ projectId: validUuid, value: -1 }).success)
      .toBe(true);
  });

  it("rejects values other than +1/-1", () => {
    expect(projectVoteSchema.safeParse({ projectId: validUuid, value: 0 }).success)
      .toBe(false);
    expect(projectVoteSchema.safeParse({ projectId: validUuid, value: 2 }).success)
      .toBe(false);
    expect(projectVoteSchema.safeParse({ projectId: validUuid, value: "1" }).success)
      .toBe(false);
  });

  it("rejects non-UUID project ids", () => {
    expect(projectVoteSchema.safeParse({ projectId: "abc", value: 1 }).success)
      .toBe(false);
    expect(projectVoteSchema.safeParse({ projectId: "", value: 1 }).success)
      .toBe(false);
  });
});

describe("profileVoteSchema", () => {
  it("accepts a valid profile vote payload", () => {
    expect(profileVoteSchema.safeParse({ profileId: validUuid, value: 1 }).success)
      .toBe(true);
  });

  it("rejects invalid profile id", () => {
    expect(profileVoteSchema.safeParse({ profileId: "not-uuid", value: 1 }).success)
      .toBe(false);
  });
});
