import { describe, expect, it } from "vitest";
import {
  MENTION_TRIGGER_REGEX,
  extractMentionUsernames,
  MENTION_MAX_PER_SOURCE,
} from "@/lib/constants/mentions";

describe("extractMentionUsernames", () => {
  it("extracts a single @username", () => {
    expect(extractMentionUsernames("hi @alice")).toEqual(["alice"]);
  });

  it("returns unique usernames in order of first occurrence", () => {
    expect(
      extractMentionUsernames("@bob hey @alice @bob @charlie"),
    ).toEqual(["bob", "alice", "charlie"]);
  });

  it("lowercases extracted usernames", () => {
    expect(extractMentionUsernames("@Alice and @BOB")).toEqual(["alice", "bob"]);
  });

  it("ignores email-like @ characters", () => {
    expect(extractMentionUsernames("contact me at foo@bar.com")).toEqual([]);
  });

  it("ignores @ immediately after letters or digits", () => {
    expect(extractMentionUsernames("price100@2x and @real")).toEqual(["real"]);
  });

  it("returns an empty array for null/empty bodies", () => {
    expect(extractMentionUsernames("")).toEqual([]);
  });

  it("respects the max-per-source cap", () => {
    const body = Array.from({ length: MENTION_MAX_PER_SOURCE + 5 })
      .map((_, index) => `@user${index}`)
      .join(" ");
    expect(extractMentionUsernames(body).length).toBe(MENTION_MAX_PER_SOURCE);
  });

  it("rejects usernames that are too short", () => {
    expect(extractMentionUsernames("@a hello")).toEqual([]);
  });

  it("supports dot, underscore, and dash inside usernames", () => {
    expect(extractMentionUsernames("@john.doe and @jane_smith-2")).toEqual([
      "john.doe",
      "jane_smith-2",
    ]);
  });
});

describe("MENTION_TRIGGER_REGEX", () => {
  it("matches a trailing @prefix on a typed line", () => {
    const match = MENTION_TRIGGER_REGEX.exec("hello @ros");
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("ros");
  });

  it("matches an empty @ token at the end (for opening the dropdown)", () => {
    const match = MENTION_TRIGGER_REGEX.exec("write something @");
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe("");
  });

  it("does not match inside an existing word like email", () => {
    expect(MENTION_TRIGGER_REGEX.exec("foo@bar")).toBeNull();
  });
});
