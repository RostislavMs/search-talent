import { describe, expect, it } from "vitest";
import {
  countBlankFields,
  fillBlankFields,
  isBlankDraftValue,
} from "@/lib/project-ai-draft";

describe("isBlankDraftValue", () => {
  it("treats null, empty strings and empty lists as blank", () => {
    expect(isBlankDraftValue(null)).toBe(true);
    expect(isBlankDraftValue(undefined)).toBe(true);
    expect(isBlankDraftValue("  ")).toBe(true);
    expect(isBlankDraftValue([])).toBe(true);
    expect(isBlankDraftValue("x")).toBe(false);
    expect(isBlankDraftValue(["Vercel"])).toBe(false);
  });
});

describe("fillBlankFields", () => {
  const current = {
    architecture: null as string | null,
    license: "MIT" as string | null,
    hosting: [] as string[],
    docsUrl: null as string | null,
  };

  it("fills only the blank fields", () => {
    const { patch, filled } = fillBlankFields(current, {
      architecture: "web_app",
      license: "GPL-3.0",
      hosting: ["Vercel"],
    });
    expect(patch).toEqual({ architecture: "web_app", hosting: ["Vercel"] });
    expect(filled).toBe(2);
  });

  it("counts the blank fields the draft had nothing for", () => {
    const { missed } = fillBlankFields(current, {
      architecture: "web_app",
      docsUrl: null,
      hosting: [],
    });
    expect(missed).toBe(2);
  });

  it("does nothing without a draft", () => {
    expect(fillBlankFields(current, undefined)).toEqual({ patch: {}, filled: 0, missed: 0 });
  });
});

describe("countBlankFields", () => {
  it("counts the listed fields that are still blank", () => {
    expect(
      countBlankFields({ a: "", b: "x", c: [] as string[] }, ["a", "b", "c"]),
    ).toBe(2);
  });
});
