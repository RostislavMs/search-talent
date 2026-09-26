import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getMarketingContent } from "@/lib/marketing-content";

/** Every nested key path of a value, with array lengths as part of the shape. */
function shapeOf(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return [
      `${path}[${value.length}]`,
      ...value.flatMap((item, index) => shapeOf(item, `${path}[${index}]`)),
    ];
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, child]) => shapeOf(child, path ? `${path}.${key}` : key));
  }
  return [path];
}

describe("home copy parity (uk/en)", () => {
  it("home, metadata.home and footer have the same shape in both locales", () => {
    for (const section of ["home", "footer"] as const) {
      expect(shapeOf(dictionaries.uk[section]), section).toEqual(
        shapeOf(dictionaries.en[section]),
      );
    }
    expect(shapeOf(dictionaries.uk.metadata.home)).toEqual(
      shapeOf(dictionaries.en.metadata.home),
    );
  });

  it("the rotating headline offers the same number of words", () => {
    expect(dictionaries.uk.home.titleWords).toHaveLength(
      dictionaries.en.home.titleWords.length,
    );
  });

  it("the marketing home block (steps, FAQ) matches between locales", () => {
    expect(shapeOf(getMarketingContent("uk").home)).toEqual(
      shapeOf(getMarketingContent("en").home),
    );
  });

  it("keeps meta descriptions within the length search results show", () => {
    for (const locale of ["uk", "en"] as const) {
      expect(
        dictionaries[locale].metadata.home.description.length,
        locale,
      ).toBeLessThanOrEqual(160);
    }
  });
});
