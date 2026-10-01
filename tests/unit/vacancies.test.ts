import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import {
  EMPTY_VACANCY_FILTERS,
  JOBS_PAGE_SIZE,
  JOBS_PATH,
  VACANCY_EXTEND_WINDOW_DAYS,
  VACANCY_KINDS,
  VACANCY_LIMITS,
  VACANCY_PAY_PERIODS_BY_KIND,
  buildJobsHref,
  buildVacancyPath,
  buildVacancySlug,
  canExtendVacancy,
  daysUntilVacancyExpires,
  defaultVacancyPayPeriod,
  formatCount,
  formatVacancyPay,
  formatVacancyPlace,
  hasVacancyFilters,
  isValidVacancySlug,
  isVacancyIndexable,
  isVacancyPayPeriodAllowed,
  isVacancyPayRequired,
  normalizeVacancyHours,
  normalizeVacancyKind,
  normalizeVacancyLevel,
  normalizeVacancyLocale,
  normalizeVacancyStatus,
  normalizeVacancyWorkFormats,
  parseVacancyFilters,
  randomVacancySlugSuffix,
  resolveVacancyState,
  toVacancyPay,
  vacancyEmploymentTypes,
  vacancyKindHasHours,
  vacancyWriteErrorCode,
  type VacancyPay,
} from "@/lib/vacancies";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("pay rules per kind", () => {
  it("requires pay for a job or an internship only", () => {
    expect(VACANCY_KINDS.map(isVacancyPayRequired)).toEqual([true, true, false, false]);
  });

  it("gives hours to a job or an internship only", () => {
    expect(VACANCY_KINDS.map(vacancyKindHasHours)).toEqual([true, true, false, false]);
  });

  it("allows only the periods that fit the kind", () => {
    expect(isVacancyPayPeriodAllowed("job", "month")).toBe(true);
    expect(isVacancyPayPeriodAllowed("job", "hour")).toBe(true);
    expect(isVacancyPayPeriodAllowed("job", "project")).toBe(false);
    expect(isVacancyPayPeriodAllowed("internship", "project")).toBe(false);
    expect(isVacancyPayPeriodAllowed("freelance", "month")).toBe(false);
    expect(isVacancyPayPeriodAllowed("freelance", "project")).toBe(true);
    for (const period of ["hour", "month", "project"] as const) {
      expect(isVacancyPayPeriodAllowed("collaboration", period)).toBe(true);
    }
  });

  it("defaults to the first period of the kind", () => {
    expect(defaultVacancyPayPeriod("job")).toBe("month");
    expect(defaultVacancyPayPeriod("internship")).toBe("month");
    expect(defaultVacancyPayPeriod("freelance")).toBe("hour");
    expect(defaultVacancyPayPeriod("collaboration")).toBe(VACANCY_PAY_PERIODS_BY_KIND.collaboration[0]);
  });
});

describe("normalizers", () => {
  it("falls back for unknown stored values", () => {
    expect(normalizeVacancyKind("internship")).toBe("internship");
    expect(normalizeVacancyKind("mentoring")).toBe("job");
    expect(normalizeVacancyKind(null)).toBe("job");
    expect(normalizeVacancyHours("part_time")).toBe("part_time");
    expect(normalizeVacancyHours("weekends")).toBeNull();
    expect(normalizeVacancyLevel("senior")).toBe("senior");
    expect(normalizeVacancyLevel("guru")).toBeNull();
    expect(normalizeVacancyStatus("closed")).toBe("closed");
    expect(normalizeVacancyStatus("deleted")).toBe("draft");
    expect(normalizeVacancyLocale("en")).toBe("en");
    expect(normalizeVacancyLocale("de")).toBe("uk");
  });

  it("keeps known work formats once each, in the canonical order", () => {
    expect(normalizeVacancyWorkFormats(["office", "space", "remote", "remote"])).toEqual(["remote", "office"]);
    expect(normalizeVacancyWorkFormats(null)).toEqual([]);
    expect(normalizeVacancyWorkFormats("remote")).toEqual([]);
  });
});

describe("toVacancyPay", () => {
  const row = { pay_min: 20_000, pay_max: 30_000, pay_currency: "uah", pay_period: "month" };

  it("reads a range and an exact amount", () => {
    expect(toVacancyPay(row)).toEqual({ min: 20_000, max: 30_000, currency: "uah", period: "month" });
    expect(toVacancyPay({ ...row, pay_max: 20_000 })).toEqual({
      min: 20_000,
      max: 20_000,
      currency: "uah",
      period: "month",
    });
  });

  it.each([
    [{ pay_min: null }],
    [{ pay_max: null }],
    [{ pay_max: 10_000 }],
    [{ pay_min: 0 }],
    [{ pay_min: 1.5 }],
    [{ pay_min: "20000" }],
    [{ pay_max: VACANCY_LIMITS.payMax + 1 }],
    [{ pay_currency: "gbp" }],
    [{ pay_currency: "UAH" }],
    [{ pay_period: "week" }],
  ])("refuses %o", (patch) => {
    expect(toVacancyPay({ ...row, ...patch })).toBeNull();
  });

  it("refuses a row without pay", () => {
    expect(toVacancyPay({})).toBeNull();
  });
});

describe("formatVacancyPay", () => {
  const range: VacancyPay = { min: 20_000, max: 30_000, currency: "uah", period: "month" };

  it("formats a range with the locale's digits", () => {
    expect(formatVacancyPay(range, dictionaries.en.vacancies.pay, "en")).toBe(
      "20,000–30,000 UAH per month",
    );
    const uk = new Intl.NumberFormat("uk-UA");
    expect(formatVacancyPay(range, dictionaries.uk.vacancies.pay, "uk")).toBe(
      `${uk.format(20_000)}–${uk.format(30_000)} UAH на місяць`,
    );
  });

  it("formats an exact amount without a dash", () => {
    expect(
      formatVacancyPay({ min: 15, max: 15, currency: "usd", period: "hour" }, dictionaries.en.vacancies.pay, "en"),
    ).toBe("15 USD per hour");
    expect(
      formatVacancyPay({ min: 800, max: 800, currency: "eur", period: "project" }, dictionaries.uk.vacancies.pay, "uk"),
    ).toBe("800 EUR за проєкт");
  });
});

describe("life cycle", () => {
  it("passes draft, closed and expired through", () => {
    expect(resolveVacancyState({ status: "draft", expiresAt: at(-DAY) }, NOW)).toBe("draft");
    expect(resolveVacancyState({ status: "closed", expiresAt: at(DAY) }, NOW)).toBe("closed");
    expect(resolveVacancyState({ status: "expired", expiresAt: at(DAY) }, NOW)).toBe("expired");
  });

  it("treats a published vacancy past its date as expired before the cron runs", () => {
    expect(resolveVacancyState({ status: "published", expiresAt: at(DAY) }, NOW)).toBe("open");
    expect(resolveVacancyState({ status: "published", expiresAt: at(-1) }, NOW)).toBe("expired");
    expect(resolveVacancyState({ status: "published", expiresAt: at(0) }, NOW)).toBe("expired");
  });

  it("keeps a published vacancy open without a readable date", () => {
    expect(resolveVacancyState({ status: "published", expiresAt: null }, NOW)).toBe("open");
    expect(resolveVacancyState({ status: "published", expiresAt: "not a date" }, NOW)).toBe("open");
  });

  it("counts whole days left, 0 on the last day", () => {
    expect(daysUntilVacancyExpires(at(5 * 60 * 60 * 1000), NOW)).toBe(0);
    expect(daysUntilVacancyExpires(at(6.5 * DAY), NOW)).toBe(6);
    expect(daysUntilVacancyExpires(at(7 * DAY), NOW)).toBe(7);
    expect(daysUntilVacancyExpires(at(0), NOW)).toBeNull();
    expect(daysUntilVacancyExpires(at(-DAY), NOW)).toBeNull();
    expect(daysUntilVacancyExpires(null, NOW)).toBeNull();
    expect(daysUntilVacancyExpires("garbage", NOW)).toBeNull();
  });

  it("offers extending in the last week and after the end", () => {
    const published = (expiresAt: string | null) => ({ status: "published" as const, expiresAt });
    expect(VACANCY_EXTEND_WINDOW_DAYS).toBe(7);
    expect(canExtendVacancy(published(at(6.9 * DAY)), NOW)).toBe(true);
    expect(canExtendVacancy(published(at(7 * DAY)), NOW)).toBe(false);
    expect(canExtendVacancy(published(at(30 * DAY)), NOW)).toBe(false);
    expect(canExtendVacancy(published(null), NOW)).toBe(false);
    expect(canExtendVacancy(published(at(-DAY)), NOW)).toBe(true);
    expect(canExtendVacancy({ status: "closed", expiresAt: at(30 * DAY) }, NOW)).toBe(true);
    expect(canExtendVacancy({ status: "expired", expiresAt: null }, NOW)).toBe(true);
    expect(canExtendVacancy({ status: "draft", expiresAt: null }, NOW)).toBe(false);
  });
});

describe("isVacancyIndexable", () => {
  const base = {
    state: "open" as const,
    moderationStatus: "approved",
    company: { verified: true, moderationStatus: "approved" },
  };

  it("indexes an open, approved vacancy of a verified, visible company", () => {
    expect(isVacancyIndexable(base)).toBe(true);
  });

  it.each([
    [{ state: "expired" as const }],
    [{ state: "closed" as const }],
    [{ state: "draft" as const }],
    [{ moderationStatus: "under_review" }],
    [{ company: { verified: false, moderationStatus: "approved" } }],
    [{ company: { verified: true, moderationStatus: "restricted" } }],
  ])("keeps %o out of search", (patch) => {
    expect(isVacancyIndexable({ ...base, ...patch })).toBe(false);
  });
});

describe("vacancyEmploymentTypes", () => {
  it("maps kinds and hours to Google's values", () => {
    expect(vacancyEmploymentTypes("job", null)).toEqual(["FULL_TIME"]);
    expect(vacancyEmploymentTypes("job", "full_time")).toEqual(["FULL_TIME"]);
    expect(vacancyEmploymentTypes("job", "part_time")).toEqual(["PART_TIME"]);
    expect(vacancyEmploymentTypes("internship", null)).toEqual(["INTERN"]);
    expect(vacancyEmploymentTypes("internship", "part_time")).toEqual(["INTERN", "PART_TIME"]);
    expect(vacancyEmploymentTypes("freelance", "full_time")).toEqual(["CONTRACTOR"]);
    expect(vacancyEmploymentTypes("collaboration", null)).toEqual(["OTHER"]);
  });
});

describe("addresses", () => {
  it.each([
    ["junior-designer-k3x9q2", true],
    ["abc", true],
    ["ab", false],
    ["new", false],
    ["edit", false],
    ["Junior-designer", false],
    ["junior--designer", false],
    ["-junior", false],
    ["junior-", false],
    ["junior designer", false],
    ["x".repeat(100), true],
    ["x".repeat(101), false],
  ])("isValidVacancySlug(%s) is %s", (slug, valid) => {
    expect(isValidVacancySlug(slug)).toBe(valid);
  });

  it("builds the page path", () => {
    expect(JOBS_PATH).toBe("/jobs");
    expect(buildVacancyPath("junior-designer-k3x9q2")).toBe("/jobs/junior-designer-k3x9q2");
  });

  it("makes six random base-36 characters", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const suffix = randomVacancySlugSuffix();
      expect(suffix).toMatch(/^[0-9a-z]{6}$/);
      seen.add(suffix);
    }
    expect(seen.size).toBeGreaterThan(40);
  });

  it("transliterates the title and adds the tail", () => {
    expect(buildVacancySlug("Junior frontend-розробник", "k3x9q2")).toBe("junior-frontend-rozrobnyk-k3x9q2");
    expect(buildVacancySlug("  Senior  QA!!  ", "aaaaaa")).toBe("senior-qa-aaaaaa");
  });

  it("falls back to a generic base and survives a reserved word", () => {
    expect(buildVacancySlug("🚀✨", "abc123")).toBe("vacancy-abc123");
    const reserved = buildVacancySlug("New", "abc123");
    expect(reserved).toBe("new-abc123");
    expect(isValidVacancySlug(reserved)).toBe(true);
  });

  it("keeps a long title within the limit and valid", () => {
    const slug = buildVacancySlug("Very long vacancy title with many words ".repeat(5), "zz9zz9");
    const base = slug.slice(0, -"-zz9zz9".length);
    expect(base.length).toBeLessThanOrEqual(80);
    expect(base.endsWith("-")).toBe(false);
    expect(isValidVacancySlug(slug)).toBe(true);
  });

  it("makes a valid address with the default random tail", () => {
    const title = "Дизайнер інтерфейсів";
    const base = buildVacancySlug(title, "x").slice(0, -2);
    const slug = buildVacancySlug(title);
    expect(slug.startsWith(`${base}-`)).toBe(true);
    expect(slug.slice(base.length + 1)).toMatch(/^[0-9a-z]{6}$/);
    expect(isValidVacancySlug(slug)).toBe(true);
    expect(buildVacancySlug(title)).not.toBe(slug);
  });
});

describe("the /jobs filters", () => {
  it("reads every known filter", () => {
    expect(
      parseVacancyFilters({
        kind: "internship",
        format: "remote",
        level: "junior",
        country: "3",
        role: "7",
        skill: "42",
        paid: "1",
        q: "  frontend  ",
        page: "2",
      }),
    ).toEqual({
      kind: "internship",
      format: "remote",
      level: "junior",
      countryId: 3,
      categoryId: 7,
      skillId: 42,
      paid: true,
      q: "frontend",
      page: 2,
    });
  });

  it("drops unknown values and takes the first of repeated ones", () => {
    expect(
      parseVacancyFilters({
        kind: "mentoring",
        format: ["hybrid", "remote"],
        level: "guru",
        country: "-1",
        role: "1e3",
        skill: "0",
        paid: "true",
        page: "abc",
      }),
    ).toEqual({ ...EMPTY_VACANCY_FILTERS, format: "hybrid" });
  });

  it("bounds the page and the search", () => {
    expect(parseVacancyFilters({ page: "0" }).page).toBe(1);
    expect(parseVacancyFilters({ page: "9999" }).page).toBe(500);
    expect(parseVacancyFilters({ page: "1234567890" }).page).toBe(1);
    expect(parseVacancyFilters({ q: "x".repeat(200) }).q).toHaveLength(80);
    expect(parseVacancyFilters({})).toEqual(EMPTY_VACANCY_FILTERS);
  });

  it("knows whether anything narrows the list", () => {
    expect(hasVacancyFilters(EMPTY_VACANCY_FILTERS)).toBe(false);
    expect(hasVacancyFilters({ ...EMPTY_VACANCY_FILTERS, page: 4 })).toBe(false);
    expect(hasVacancyFilters({ ...EMPTY_VACANCY_FILTERS, q: "qa" })).toBe(true);
    expect(hasVacancyFilters({ ...EMPTY_VACANCY_FILTERS, paid: true })).toBe(true);
    expect(hasVacancyFilters({ ...EMPTY_VACANCY_FILTERS, skillId: 1 })).toBe(true);
  });

  it("builds the address without empty parameters", () => {
    expect(buildJobsHref({})).toBe("/jobs");
    expect(buildJobsHref(EMPTY_VACANCY_FILTERS)).toBe("/jobs");
    expect(buildJobsHref({ page: 1, q: "   " })).toBe("/jobs");
    expect(buildJobsHref({ kind: "freelance", paid: true, q: " c++ dev ", page: 3 })).toBe(
      "/jobs?kind=freelance&paid=1&q=c%2B%2B+dev&page=3",
    );
  });

  it("round-trips through the address", () => {
    const filters = {
      kind: "job" as const,
      format: "office" as const,
      level: "middle" as const,
      countryId: 1,
      categoryId: 2,
      skillId: 3,
      paid: true,
      q: "react",
      page: 5,
    };
    const query = new URLSearchParams(buildJobsHref(filters).split("?")[1]);
    expect(parseVacancyFilters(Object.fromEntries(query))).toEqual(filters);
  });

  it("pages by twenty", () => {
    expect(JOBS_PAGE_SIZE).toBe(20);
  });
});

describe("small helpers", () => {
  it("formats the place from whatever exists", () => {
    expect(formatVacancyPlace("Київ", "Україна")).toBe("Київ, Україна");
    expect(formatVacancyPlace("  ", "Poland")).toBe("Poland");
    expect(formatVacancyPlace("Lviv", undefined)).toBe("Lviv");
    expect(formatVacancyPlace(null, null)).toBeNull();
  });

  it("picks Ukrainian plural forms", () => {
    const forms = { one: "{count} вакансія", few: "{count} вакансії", many: "{count} вакансій", other: "{count} вакансії" };
    expect(formatCount(1, forms, "uk")).toBe("1 вакансія");
    expect(formatCount(3, forms, "uk")).toBe("3 вакансії");
    expect(formatCount(5, forms, "uk")).toBe("5 вакансій");
    expect(formatCount(11, forms, "uk")).toBe("11 вакансій");
    expect(formatCount(21, forms, "uk")).toBe("21 вакансія");
    expect(formatCount(0, forms, "uk")).toBe("0 вакансій");
    expect(formatCount(1000, forms, "uk")).toBe(`${new Intl.NumberFormat("uk-UA").format(1000)} вакансій`);
  });

  it("picks English plural forms", () => {
    const forms = dictionaries.en.vacancies.list.count;
    expect(formatCount(1, forms, "en")).toBe("1 open position");
    expect(formatCount(2, forms, "en")).toBe("2 open positions");
    expect(formatCount(1500, forms, "en")).toBe("1,500 open positions");
  });

  it("keeps the limits the database enforces", () => {
    expect(VACANCY_LIMITS).toMatchObject({
      titleMin: 3,
      titleMax: 120,
      descriptionMax: 20_000,
      descriptionTextMin: 80,
      skillsMax: 15,
      openDays: 60,
      perCompanyPerDay: 5,
    });
  });
});

describe("vacancyWriteErrorCode", () => {
  it.each([
    [{ code: "P0001", message: "vacancy_daily_limit_reached" }, "daily_limit"],
    [{ code: "P0001", message: "invalid_vacancy_status" }, "invalid_status"],
    [
      { code: "23514", message: 'new row for relation "vacancies" violates check constraint "vacancies_pay_required_check"' },
      "pay_required",
    ],
    [{ code: "P0001", message: "vacancy_skills_limit_reached" }, "skills_limit"],
    [{ code: "42501", message: "new row violates row-level security policy" }, "forbidden"],
    [{ code: "42501", message: "vacancy_daily_limit_reached" }, "daily_limit"],
    [{ code: "23505", message: "duplicate key" }, "invalid"],
    [{ code: null, message: null }, "invalid"],
    [{}, "invalid"],
  ])("maps %o to %s", (error, code) => {
    expect(vacancyWriteErrorCode(error)).toBe(code);
  });

  it("is null without an error", () => {
    expect(vacancyWriteErrorCode(null)).toBeNull();
  });
});
