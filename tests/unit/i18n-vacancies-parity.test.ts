import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import {
  VACANCY_HOURS,
  VACANCY_KINDS,
  VACANCY_LEVELS,
  VACANCY_LOCALES,
  VACANCY_PAY_PERIODS,
  VACANCY_WORK_FORMATS,
  type VacancyState,
} from "@/lib/vacancies";
import type { VacancyReadinessIssue } from "@/lib/validation/vacancies";

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

const STATES: VacancyState[] = ["draft", "open", "closed", "expired"];
const ISSUES: VacancyReadinessIssue[] = ["description_short", "pay_required"];
const LOCALES = ["en", "uk"] as const;

describe("vacancy copy parity (uk/en)", () => {
  const en = dictionaries.en.vacancies;
  const uk = dictionaries.uk.vacancies;

  it("has the same shape in both locales", () => {
    expect(shapeOf(uk)).toEqual(shapeOf(en));
  });

  it("uses the same placeholders in both locales", () => {
    const english = leaves(en);
    const ukrainian = leaves(uk);
    expect(ukrainian).toHaveLength(english.length);
    english.forEach((text, index) => {
      expect(placeholders(ukrainian[index]), `${ukrainian[index]} / ${text}`).toEqual(placeholders(text));
    });
  });

  it("has no empty strings", () => {
    for (const locale of [en, uk]) {
      for (const text of leaves(locale)) {
        expect(text.trim().length, JSON.stringify(text)).toBeGreaterThan(0);
      }
    }
  });

  it("names every kind, hours, format, level, period, state and language", () => {
    for (const locale of LOCALES) {
      const copy = dictionaries[locale].vacancies;
      for (const kind of VACANCY_KINDS) expect(copy.kinds[kind], kind).toBeTruthy();
      for (const hours of VACANCY_HOURS) expect(copy.hours[hours], hours).toBeTruthy();
      for (const format of VACANCY_WORK_FORMATS) expect(copy.formats[format], format).toBeTruthy();
      for (const level of VACANCY_LEVELS) expect(copy.levels[level], level).toBeTruthy();
      for (const period of VACANCY_PAY_PERIODS) {
        expect(copy.payPeriods[period], period).toBeTruthy();
        expect(copy.pay[period]).toContain("{amount}");
        expect(copy.pay[period]).toContain("{currency}");
      }
      for (const state of STATES) expect(copy.states[state], state).toBeTruthy();
      for (const language of VACANCY_LOCALES) expect(copy.languages[language], language).toBeTruthy();
      for (const issue of ISSUES) expect(copy.form.errors[issue], issue).toBeTruthy();
    }
  });

  it("has every plural form the counters use", () => {
    for (const locale of LOCALES) {
      const copy = dictionaries[locale].vacancies;
      for (const forms of [copy.list.count, copy.mine.views]) {
        for (const form of ["one", "few", "many", "other"] as const) {
          expect(forms[form]).toContain("{count}");
        }
      }
    }
  });

  it("keeps the list's meta within a search snippet", () => {
    for (const locale of [en, uk]) {
      expect(locale.meta.listTitle.length).toBeLessThanOrEqual(60);
      expect(locale.meta.listDescription.length).toBeLessThanOrEqual(160);
    }
  });
});

describe("vacancy labels elsewhere", () => {
  it("adds the menu and admin labels in both locales", () => {
    for (const locale of LOCALES) {
      const dictionary = dictionaries[locale];
      expect(dictionary.nav.jobs).toBeTruthy();
      expect(dictionary.nav.myVacancies).toBeTruthy();
      expect(dictionary.admin.contentNav.vacancies).toBeTruthy();
    }
    expect(dictionaries.en.nav.jobs).toBe("Jobs");
  });

  it("has the notification copy in both locales", () => {
    for (const locale of LOCALES) {
      const actions = dictionaries[locale].notifications.actions;
      expect(actions.vacancyApproved).toContain("{title}");
      expect(actions.vacancyExpired).toBeTruthy();
      expect(actions.moderation.removed.vacancy).toContain("{title}");
      expect(actions.moderation.restricted.vacancy).toContain("{title}");
    }
  });

  it("no longer says vacancies are on their way", () => {
    for (const locale of LOCALES) {
      const faq = JSON.stringify(dictionaries[locale].companies.landing.faq);
      expect(faq).not.toMatch(/on their way|coming soon|на підході|незабаром/i);
    }
    const englishFaq = dictionaries.en.companies.landing.faq.map((entry) => entry.q);
    expect(englishFaq).toContain("Can I post a vacancy?");
    expect(dictionaries.en.companies.landing.faq.find((entry) => entry.q === "Can I post a vacancy?")?.a).toMatch(
      /^Yes\./,
    );
    expect(dictionaries.uk.companies.landing.faq.find((entry) => entry.q === "Можна розмістити вакансію?")?.a).toMatch(
      /^Так\./,
    );
  });
});
