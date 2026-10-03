import { describe, expect, it } from "vitest";
import { dictionaries, type Dictionary } from "@/lib/i18n/dictionaries";

/** Every nested key path of a value. */
function shapeOf(value: unknown, path = ""): string[] {
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, child]) => shapeOf(child, path ? `${path}.${key}` : key));
  }
  return [path];
}

/** Leaves in the same order as shapeOf, so the two locales line up. */
function leaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([, child]) => leaves(child));
  }
  return [];
}

function placeholders(text: string): string[] {
  return (text.match(/\{[a-z]+\}/gi) ?? []).sort();
}

function expectParity(en: unknown, uk: unknown) {
  expect(shapeOf(uk)).toEqual(shapeOf(en));
  const english = leaves(en);
  const ukrainian = leaves(uk);
  expect(ukrainian).toHaveLength(english.length);
  english.forEach((text, index) => {
    expect(placeholders(ukrainian[index]), `${ukrainian[index]} / ${text}`).toEqual(placeholders(text));
  });
  for (const text of [...english, ...ukrainian]) {
    expect(text.trim().length, JSON.stringify(text)).toBeGreaterThan(0);
  }
}

const en = dictionaries.en;
const uk = dictionaries.uk;

describe("hiring 8.4 copy parity (uk/en)", () => {
  it("job alerts", () => {
    expectParity(en.jobAlerts, uk.jobAlerts);
  });

  it("the job alert email", () => {
    expectParity(en.emails.jobAlert, uk.emails.jobAlert);
  });

  it("«Зв'язатися» on behalf of a company", () => {
    const pick = (copy: Dictionary["openTo"]) => ({
      contactAs: copy.contactAs,
      contactAsYou: copy.contactAsYou,
      contactAsHint: copy.contactAsHint,
      contactAsCompanyNote: copy.contactAsCompanyNote,
      companyRateLimited: copy.companyRateLimited,
      companiesOpened: copy.companiesOpened,
    });
    expectParity(pick(en.openTo), pick(uk.openTo));
  });

  it("notifications", () => {
    const pick = (copy: Dictionary["notifications"]) => ({
      jobAlertsActor: copy.jobAlertsActor,
      vacancyMatchOne: copy.actions.vacancyMatchOne,
      vacancyMatchMany: copy.actions.vacancyMatchMany,
      vacancyMatchSearch: copy.actions.vacancyMatchSearch,
      companyContactOpened: copy.actions.companyContactOpened,
      jobs: copy.filters.jobs,
    });
    expectParity(pick(en.notifications), pick(uk.notifications));
    expect(en.notifications.pluralLocale).toBe("en");
    expect(uk.notifications.pluralLocale).toBe("uk");
  });

  it("hiring metrics", () => {
    expectParity(en.admin.metrics.hiring, uk.admin.metrics.hiring);
  });

  it("names no private files in what people read", () => {
    const texts = [
      ...leaves(en.jobAlerts),
      ...leaves(uk.jobAlerts),
      ...leaves(en.admin.metrics.hiring),
      ...leaves(uk.admin.metrics.hiring),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/\.sql|database\//);
    }
  });
});
