import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  APPLICATION_TEAM_FILTERS,
  APPLY_REFUSALS,
  TEAM_APPLICATION_STATUSES,
} from "@/lib/applications";
import { dictionaries } from "@/lib/i18n/dictionaries";

/** Every nested key path of a value; arrays keep their length. */
function shapeOf(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => shapeOf(child, `${path}[${index}]`));
  }
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
  if (Array.isArray(value)) return value.flatMap(leaves);
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

const LOCALES = ["en", "uk"] as const;

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

describe("application copy parity (uk/en)", () => {
  it("has the same shape and placeholders in both locales", () => {
    expectParity(dictionaries.en.applications, dictionaries.uk.applications);
  });

  it("has the same emails in both locales", () => {
    expectParity(dictionaries.en.emails.applicationReceived, dictionaries.uk.emails.applicationReceived);
    expectParity(dictionaries.en.emails.applicationStatus, dictionaries.uk.emails.applicationStatus);
  });

  it("names every status for the candidate and the team", () => {
    for (const locale of LOCALES) {
      const copy = dictionaries[locale].applications;
      for (const status of APPLICATION_STATUSES) {
        expect(copy.candidateStatuses[status], status).toBeTruthy();
        expect(copy.candidateStatusHints[status], status).toBeTruthy();
        expect(copy.teamStatuses[status], status).toBeTruthy();
      }
      for (const filter of APPLICATION_TEAM_FILTERS) expect(copy.team.filters[filter], filter).toBeTruthy();
      for (const refusal of APPLY_REFUSALS) expect(copy.apply.errors[refusal], refusal).toBeTruthy();
      for (const status of TEAM_APPLICATION_STATUSES) expect(copy.team.actions.saved[status], status).toBeTruthy();
    }
  });

  it("has every plural form the counters use", () => {
    for (const locale of LOCALES) {
      const copy = dictionaries[locale].applications;
      for (const forms of [copy.team.count, copy.team.freshCount, copy.mySpaceCard.vacancies]) {
        for (const form of ["one", "few", "many", "other"] as const) {
          expect(forms[form]).toContain("{count}");
        }
      }
    }
  });

  it("names the company in the consent", () => {
    for (const locale of LOCALES) {
      expect(dictionaries[locale].applications.apply.consent).toContain("{company}");
    }
  });
});

describe("application labels elsewhere", () => {
  it("adds the menu link and the notification filter", () => {
    for (const locale of LOCALES) {
      const dictionary = dictionaries[locale];
      expect(dictionary.nav.myApplications).toBeTruthy();
      expect(dictionary.notifications.filters.applications).toBeTruthy();
    }
    expect(dictionaries.uk.nav.myApplications).toBe("Мої відгуки");
  });

  it("has the notification copy in both locales", () => {
    for (const locale of LOCALES) {
      const actions = dictionaries[locale].notifications.actions;
      expect(actions.applicationReceived).toContain("{title}");
      for (const status of ["viewed", "shortlisted", "rejected", "hired"] as const) {
        expect(actions.applicationStatus[status]).toContain("{title}");
      }
    }
  });

  it("explains applications to companies", () => {
    expect(dictionaries.en.companies.landing.faq.map((entry) => entry.q)).toContain("How do applications work?");
    expect(dictionaries.uk.companies.landing.faq.map((entry) => entry.q)).toContain("Як працюють відгуки?");
  });
});
