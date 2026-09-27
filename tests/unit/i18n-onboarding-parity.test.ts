import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";

/** Every nested key path of a value. */
function shapeOf(value: unknown, path = ""): string[] {
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, child]) => shapeOf(child, path ? `${path}.${key}` : key));
  }
  return [path];
}

function placeholders(text: string): string[] {
  return (text.match(/\{[a-z]+\}/gi) ?? []).sort();
}

function leaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(leaves);
  }
  return [];
}

const sections = ["onboarding", "profileShare", "mySpace", "emailVerification"] as const;

describe("onboarding copy parity (uk/en)", () => {
  it.each(sections)("%s has the same shape in both locales", (section) => {
    expect(shapeOf(dictionaries.uk[section])).toEqual(shapeOf(dictionaries.en[section]));
  });

  it("the verify screen and page metadata match too", () => {
    expect(shapeOf(dictionaries.uk.auth.verify)).toEqual(shapeOf(dictionaries.en.auth.verify));
    expect(shapeOf(dictionaries.uk.metadata.onboarding)).toEqual(
      shapeOf(dictionaries.en.metadata.onboarding),
    );
  });

  it("uses the same placeholders in both locales", () => {
    for (const section of sections) {
      const en = leaves(dictionaries.en[section]);
      const uk = leaves(dictionaries.uk[section]);
      en.forEach((english, index) => {
        expect(placeholders(uk[index]), uk[index]).toEqual(placeholders(english));
      });
    }
  });

  it("keeps the onboarding metadata description under 160 characters", () => {
    for (const locale of ["uk", "en"] as const) {
      expect(dictionaries[locale].metadata.onboarding.description.length).toBeLessThanOrEqual(160);
    }
  });
});
