import { describe, expect, it } from "vitest";
import {
  USERNAME_PATTERN,
  generateTemporaryUsername,
  isEmailDerivedUsername,
  isTemporaryUsername,
  needsOwnUsername,
  normalizeUsernameCandidate,
  suggestUsernameFromName,
} from "@/lib/username";

describe("generateTemporaryUsername", () => {
  it("makes a neutral user-xxxxxx nick that passes validation", () => {
    for (let index = 0; index < 50; index += 1) {
      const username = generateTemporaryUsername();
      expect(username).toMatch(/^user-[0-9a-f]{6}$/);
      expect(USERNAME_PATTERN.test(username)).toBe(true);
      expect(isTemporaryUsername(username)).toBe(true);
    }
  });

  it("takes the first hex digits of the random id as they are", () => {
    expect(generateTemporaryUsername(() => "3F2A9C1B-7E4D-4C8A-9B1E-0D5F6A7B8C9D")).toBe(
      "user-3f2a9c",
    );
    expect(generateTemporaryUsername(() => "ab-cd-ef12-3456")).toBe("user-abcdef");
  });
});

describe("isTemporaryUsername", () => {
  it("only matches the generated shape", () => {
    expect(isTemporaryUsername("user-ab12cd")).toBe(true);
    expect(isTemporaryUsername("USER-AB12CD")).toBe(true);
    expect(isTemporaryUsername("user-ab12c")).toBe(false);
    expect(isTemporaryUsername("user-ab12cde")).toBe(false);
    expect(isTemporaryUsername("user-zz99zz")).toBe(false);
    expect(isTemporaryUsername("olena")).toBe(false);
    expect(isTemporaryUsername(null)).toBe(false);
  });
});

describe("normalizeUsernameCandidate", () => {
  it("lowercases and replaces unsupported characters", () => {
    expect(normalizeUsernameCandidate("  John+Smith ")).toBe("john-smith");
    expect(normalizeUsernameCandidate("--a--b--")).toBe("a-b");
    expect(normalizeUsernameCandidate("")).toBe("");
    expect(normalizeUsernameCandidate(undefined)).toBe("");
  });
});

describe("isEmailDerivedUsername", () => {
  it("spots a nick copied from the email local part", () => {
    expect(isEmailDerivedUsername("garbarilly2008", "garbarilly2008@gmail.com")).toBe(true);
    expect(isEmailDerivedUsername("john-smith", "John+Smith@example.com")).toBe(true);
    expect(isEmailDerivedUsername("code.max.0921", "code.max.0921@ukr.net")).toBe(true);
  });

  it("includes the numeric suffix the old generator added", () => {
    expect(isEmailDerivedUsername("olena-2", "olena@example.com")).toBe(true);
    expect(isEmailDerivedUsername("olena-dev", "olena@example.com")).toBe(false);
  });

  it("does not flag nicks the person picked", () => {
    expect(isEmailDerivedUsername("rostyslav", "r.mosiichuk@example.com")).toBe(false);
    expect(isEmailDerivedUsername("olena", null)).toBe(false);
    expect(isEmailDerivedUsername(null, "olena@example.com")).toBe(false);
    expect(isEmailDerivedUsername("olena", "not-an-email")).toBe(false);
  });

  it("treats regex characters in the email literally", () => {
    expect(isEmailDerivedUsername("a.b", "a.b@example.com")).toBe(true);
    expect(isEmailDerivedUsername("axb", "a.b@example.com")).toBe(false);
  });
});

describe("needsOwnUsername", () => {
  it("is true for missing, temporary and email-derived nicks", () => {
    expect(needsOwnUsername(null, "a@b.co")).toBe(true);
    expect(needsOwnUsername("user-ab12cd", "a@b.co")).toBe(true);
    expect(needsOwnUsername("olena", "olena@example.com")).toBe(true);
    expect(needsOwnUsername("olena.koval", "olena@example.com")).toBe(false);
  });
});

describe("suggestUsernameFromName", () => {
  it("transliterates Ukrainian names into a dotted nick", () => {
    expect(suggestUsernameFromName("Олена Коваль")).toBe("olena.koval");
    expect(suggestUsernameFromName("Юрій Щербак")).toBe("yuriy.shcherbak");
  });

  it("handles Latin names with accents and extra spaces", () => {
    expect(suggestUsernameFromName("  José   Álvarez ")).toBe("jose.alvarez");
  });

  it("caps the length and never ends on a separator", () => {
    const suggestion = suggestUsernameFromName("A".repeat(31) + " Bcdef");
    expect(suggestion).not.toBeNull();
    expect(suggestion!.length).toBeLessThanOrEqual(32);
    expect(suggestion).not.toMatch(/[._-]$/);
  });

  it("returns null when nothing valid is left", () => {
    expect(suggestUsernameFromName("")).toBeNull();
    expect(suggestUsernameFromName("🙂")).toBeNull();
    expect(suggestUsernameFromName("Ян")).toBe("yan");
    expect(suggestUsernameFromName("Ю")).toBeNull();
    expect(suggestUsernameFromName(null)).toBeNull();
  });
});
