import { describe, expect, it } from "vitest";
import {
  BADGE_LABEL,
  buildBadgeMarkdown,
  getBadgeMessage,
  measureBadgeText,
  renderBadgeSvg,
} from "@/lib/portfolio-badge";

function attribute(svg: string, name: string): string | null {
  return svg.match(new RegExp(`<svg[^>]* ${name}="([^"]+)"`))?.[1] ?? null;
}

describe("getBadgeMessage", () => {
  it("shows the score out of 100, clamped and rounded", () => {
    expect(getBadgeMessage(72)).toBe("72/100");
    expect(getBadgeMessage(71.6)).toBe("72/100");
    expect(getBadgeMessage(0)).toBe("0/100");
    expect(getBadgeMessage(140)).toBe("100/100");
  });

  it("says portfolio before there is a score", () => {
    expect(getBadgeMessage(null)).toBe("portfolio");
    expect(getBadgeMessage(undefined)).toBe("portfolio");
    expect(getBadgeMessage(Number.NaN)).toBe("portfolio");
  });
});

describe("measureBadgeText", () => {
  it("grows with the text and treats unknown characters as average", () => {
    expect(measureBadgeText("")).toBe(0);
    expect(measureBadgeText("100/100")).toBeGreaterThan(measureBadgeText("72/100"));
    expect(measureBadgeText("ж")).toBeGreaterThan(0);
  });
});

describe("renderBadgeSvg", () => {
  it("is a 20 px badge as wide as its two halves", () => {
    const svg = renderBadgeSvg({ message: "72/100" });
    const width = Number(attribute(svg, "width"));

    expect(attribute(svg, "height")).toBe("20");
    expect(width).toBe(
      Math.round(measureBadgeText(BADGE_LABEL) + 12) + Math.round(measureBadgeText("72/100") + 12),
    );
    expect(svg).toContain(">SearchTalent</text>");
    expect(svg).toContain(">72/100</text>");
    expect(svg).toContain('aria-label="SearchTalent: 72/100"');
    expect(svg).toContain("#c2532e");
  });

  it("uses grey for the not-found badge", () => {
    const svg = renderBadgeSvg({ message: "not found", muted: true });
    expect(svg).not.toContain("#c2532e");
    expect(svg).toContain("#78716c");
  });

  it("escapes the message", () => {
    const svg = renderBadgeSvg({ message: '<script>"x"</script>' });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  });

  it("carries nothing that could run or load", () => {
    const svg = renderBadgeSvg({ message: "72/100" });
    expect(svg).not.toMatch(/<script|<image|href=|on[a-z]+=/i);
  });
});

describe("buildBadgeMarkdown", () => {
  it("wraps the badge image in a link to the portfolio", () => {
    expect(
      buildBadgeMarkdown({
        badgeUrl: "https://searchtalent.dev/api/badge/olena.svg",
        portfolioUrl: "https://searchtalent.dev/u/olena?utm_source=badge&utm_medium=portfolio",
      }),
    ).toBe(
      "[![SearchTalent portfolio](https://searchtalent.dev/api/badge/olena.svg)](https://searchtalent.dev/u/olena?utm_source=badge&utm_medium=portfolio)",
    );
  });
});
