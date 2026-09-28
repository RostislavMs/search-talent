import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import {
  OPEN_TO_REMINDER_DAYS,
  formatOpenToList,
  isOpenToOption,
  isOpenToStale,
  normalizeOpenTo,
  openToFromEmploymentTypes,
  openToOptions,
} from "@/lib/open-to";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-28T12:00:00Z");

describe("normalizeOpenTo", () => {
  it("keeps known values once, in the canonical order", () => {
    expect(normalizeOpenTo(["mentoring", "job", "freelance", "job"])).toEqual([
      "freelance",
      "job",
      "mentoring",
    ]);
  });

  it("drops unknown values and non-arrays", () => {
    expect(normalizeOpenTo(["vacancy", 3, null, "internship"])).toEqual(["internship"]);
    expect(normalizeOpenTo("freelance")).toEqual([]);
    expect(normalizeOpenTo(null)).toEqual([]);
  });

  it("recognises every option", () => {
    expect(openToOptions.every(isOpenToOption)).toBe(true);
    expect(isOpenToOption("full_time")).toBe(false);
  });
});

describe("openToFromEmploymentTypes", () => {
  it("maps the old employment types as the migration does", () => {
    expect(openToFromEmploymentTypes(["freelance"])).toEqual(["freelance"]);
    expect(openToFromEmploymentTypes(["internship"])).toEqual(["internship"]);
    expect(openToFromEmploymentTypes(["full_time", "part_time", "contract"])).toEqual(["job"]);
    expect(openToFromEmploymentTypes(["contract", "freelance", "internship"])).toEqual([
      "freelance",
      "job",
      "internship",
    ]);
  });

  it("ignores anything else", () => {
    expect(openToFromEmploymentTypes(["volunteer", 1])).toEqual([]);
    expect(openToFromEmploymentTypes(undefined)).toEqual([]);
  });
});

describe("isOpenToStale", () => {
  it("is never stale when the status is off", () => {
    expect(isOpenToStale([], null, NOW)).toBe(false);
    expect(isOpenToStale([], "2020-01-01T00:00:00Z", NOW)).toBe(false);
  });

  it(`asks again after ${OPEN_TO_REMINDER_DAYS} days`, () => {
    const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

    expect(isOpenToStale(["freelance"], at(OPEN_TO_REMINDER_DAYS - 1), NOW)).toBe(false);
    expect(isOpenToStale(["freelance"], at(OPEN_TO_REMINDER_DAYS), NOW)).toBe(true);
    expect(isOpenToStale(["freelance"], at(200), NOW)).toBe(true);
  });

  it("treats a status without a date as old", () => {
    expect(isOpenToStale(["job"], null, NOW)).toBe(true);
    expect(isOpenToStale(["job"], "not a date", NOW)).toBe(true);
  });
});

describe("formatOpenToList", () => {
  it("words the list for «Відкрито до: …» in each locale", () => {
    expect(formatOpenToList(["internship", "freelance"], dictionaries.uk.openTo.phrases)).toBe(
      "фрилансу, стажування",
    );
    expect(formatOpenToList(["job", "mentoring"], dictionaries.en.openTo.phrases)).toBe(
      "a job, mentoring",
    );
  });

  it("is empty for an empty or unknown status", () => {
    expect(formatOpenToList([], dictionaries.uk.openTo.phrases)).toBe("");
    expect(formatOpenToList(["vacancy"], dictionaries.en.openTo.phrases)).toBe("");
  });
});

describe("openTo copy (uk/en)", () => {
  function keys(value: unknown, path = ""): string[] {
    if (value && typeof value === "object") {
      return Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([key, child]) => keys(child, path ? `${path}.${key}` : key));
    }
    return [path];
  }

  it("has the same keys in both locales", () => {
    expect(keys(dictionaries.uk.openTo)).toEqual(keys(dictionaries.en.openTo));
  });

  it("has a label, a hint and a phrase for every option", () => {
    for (const locale of ["uk", "en"] as const) {
      const copy = dictionaries[locale].openTo;
      for (const option of openToOptions) {
        expect(copy.options[option], `${locale} ${option}`).toBeTruthy();
        expect(copy.hints[option], `${locale} ${option}`).toBeTruthy();
        expect(copy.phrases[option], `${locale} ${option}`).toBeTruthy();
      }
    }
  });

  it("keeps the placeholders the components fill in", () => {
    for (const locale of ["uk", "en"] as const) {
      const copy = dictionaries[locale].openTo;
      expect(copy.badge).toContain("{list}");
      expect(copy.reminderTitle).toContain("{list}");
      expect(copy.dialogTitle).toContain("{name}");
    }
  });
});
