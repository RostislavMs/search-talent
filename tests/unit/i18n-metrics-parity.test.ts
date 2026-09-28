import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { getLegalDocument } from "@/lib/legal-content";

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

function placeholders(text: string): string[] {
  return (text.match(/\{[a-z]+\}/gi) ?? []).sort();
}

describe("product metrics copy parity (uk/en)", () => {
  it("admin.metrics and admin.nav have the same shape in both locales", () => {
    expect(shapeOf(dictionaries.uk.admin.metrics)).toEqual(
      shapeOf(dictionaries.en.admin.metrics),
    );
    expect(shapeOf(dictionaries.uk.admin.nav)).toEqual(shapeOf(dictionaries.en.admin.nav));
  });

  it("uses the same placeholders in both locales", () => {
    const en = dictionaries.en.admin.metrics;
    const uk = dictionaries.uk.admin.metrics;
    const pairs: Array<[string, string]> = [
      [en.excludedAdmins, uk.excludedAdmins],
      [en.tiles.activatedHint, uk.tiles.activatedHint],
      [en.tiles.signupsHint, uk.tiles.signupsHint],
      [en.tiles.firstProjectHint, uk.tiles.firstProjectHint],
      [en.units.hours, uk.units.hours],
      [en.units.days, uk.units.days],
      [en.portfolioSignups.note, uk.portfolioSignups.note],
    ];
    for (const [english, ukrainian] of pairs) {
      expect(placeholders(ukrainian), ukrainian).toEqual(placeholders(english));
    }
  });

  it("privacy and cookie policies stay structurally identical", () => {
    for (const key of ["privacy", "cookies"] as const) {
      expect(shapeOf(getLegalDocument("uk", key)), key).toEqual(
        shapeOf(getLegalDocument("en", key)),
      );
    }
  });
});
