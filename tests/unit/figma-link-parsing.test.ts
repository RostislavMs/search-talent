import { describe, expect, it } from "vitest";
import { parseFigmaFileKey } from "@/lib/integrations/figma";

describe("parseFigmaFileKey", () => {
  it("reads a file key out of every file-ish URL shape", () => {
    const key = "aBcDeFgHiJkL123";

    for (const path of ["file", "design", "board", "slides", "proto"]) {
      expect(
        parseFigmaFileKey(`https://www.figma.com/${path}/${key}/My-Project`),
      ).toBe(key);
    }
  });

  it("accepts a bare file key", () => {
    expect(parseFigmaFileKey("aBcDeFgHiJkL123")).toBe("aBcDeFgHiJkL123");
  });

  it("keeps query strings and node ids out of the way", () => {
    expect(
      parseFigmaFileKey(
        "https://www.figma.com/design/aBcDeFgHiJkL123/Name?node-id=1-2&t=abc",
      ),
    ).toBe("aBcDeFgHiJkL123");
  });

  // A public OAuth app may not call Figma's projects endpoints, so these links
  // must not be treated as importable.
  it("refuses team and project links", () => {
    expect(
      parseFigmaFileKey("https://www.figma.com/files/team/98765/Team-Name"),
    ).toBeNull();
    expect(
      parseFigmaFileKey("https://www.figma.com/files/project/12345/Some-Project"),
    ).toBeNull();
  });

  it("rejects non-Figma hosts and unparseable input", () => {
    expect(parseFigmaFileKey("https://notfigma.com/design/aBcDeFgHiJkL123")).toBeNull();
    expect(parseFigmaFileKey("https://example.com/design/aBcDeFgHiJkL123")).toBeNull();
    expect(parseFigmaFileKey("https://www.figma.com/")).toBeNull();
    expect(parseFigmaFileKey("just some words")).toBeNull();
    expect(parseFigmaFileKey("")).toBeNull();
    expect(parseFigmaFileKey("   ")).toBeNull();
  });
});
