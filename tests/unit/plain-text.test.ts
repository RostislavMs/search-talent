import { describe, expect, it } from "vitest";
import { toPlainText } from "@/lib/plain-text";

describe("toPlainText", () => {
  it("returns an empty string for nullish input", () => {
    expect(toPlainText(null)).toBe("");
    expect(toPlainText(undefined)).toBe("");
    expect(toPlainText("")).toBe("");
  });

  it("strips wrapping <p> tags", () => {
    expect(toPlainText("<p>Qifrey in focus.</p>")).toBe("Qifrey in focus.");
  });

  it("joins block boundaries with a single space", () => {
    expect(toPlainText("<p>One</p><p>Two</p>")).toBe("One Two");
    expect(toPlainText("Line one<br>Line two")).toBe("Line one Line two");
  });

  it("removes inline formatting tags but keeps their text", () => {
    expect(toPlainText("A <strong>bold</strong> and <em>italic</em> word")).toBe(
      "A bold and italic word",
    );
  });

  it("leaves bare comparison operators alone", () => {
    expect(toPlainText("a < b and c > d")).toBe("a < b and c > d");
  });

  it("collapses whitespace", () => {
    expect(toPlainText("<p>  spaced   out  </p>")).toBe("spaced out");
  });

  it("passes through plain text unchanged", () => {
    expect(toPlainText("Just a normal description")).toBe(
      "Just a normal description",
    );
  });
});
