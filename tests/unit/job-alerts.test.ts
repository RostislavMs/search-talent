import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import {
  JOB_ALERTS_PATH,
  JOB_ALERT_LIMITS,
  describeJobAlertFilters,
  jobAlertHref,
  jobAlertWriteErrorCode,
  readJobAlertFilters,
  readJobAlertTarget,
  sameJobAlertFilters,
  toJobAlertParams,
  vacancyKindsFromOpenTo,
  vacancyLiveSince,
  vacancyMatchesFilters,
  vacancyMatchesProfile,
  withoutPage,
  type JobAlertFilters,
  type MatchableVacancy,
} from "@/lib/job-alerts";
import { EMPTY_VACANCY_FILTERS, parseVacancyFilters } from "@/lib/vacancies";

const NONE: JobAlertFilters = withoutPage(EMPTY_VACANCY_FILTERS);

const vacancy: MatchableVacancy = {
  kind: "internship",
  workFormats: ["remote", "hybrid"],
  experienceLevel: "junior",
  countryId: 1,
  categoryId: 7,
  skillIds: [10, 11],
  hasPay: true,
  title: "Junior Frontend-розробник (React)",
};

describe("job alert params", () => {
  it("stores the filters as the address carries them, only what narrows", () => {
    expect(
      toJobAlertParams({ ...NONE, kind: "internship", countryId: 12, paid: true, q: "  react " }),
    ).toEqual({ kind: "internship", country: "12", paid: "1", q: "react" });
    expect(toJobAlertParams(NONE)).toEqual({});
  });

  it("gives the same object for the same filters, whatever the order", () => {
    const left = toJobAlertParams({ ...NONE, format: "remote", kind: "job" });
    const right = toJobAlertParams({ ...NONE, kind: "job", format: "remote" });
    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
  });

  it("reads back what it stored, numbers too, dropping anything unknown", () => {
    expect(readJobAlertFilters({ kind: "internship", country: "12", paid: "1", evil: "x", page: "4" })).toEqual({
      ...NONE,
      kind: "internship",
      countryId: 12,
      paid: true,
    });
    expect(readJobAlertFilters({ skill: 5, role: Number.NaN, level: ["junior"] })).toEqual({ ...NONE, skillId: 5 });
    expect(readJobAlertFilters({ kind: "mentoring", format: "moon" })).toEqual(NONE);
  });

  it("treats anything that is not an object as no filters", () => {
    for (const value of [null, undefined, "kind=job", 5, ["job"]]) {
      expect(readJobAlertFilters(value)).toEqual(NONE);
    }
  });

  it("tells a profile match from a search", () => {
    expect(readJobAlertTarget({ match: "profile" })).toEqual({ type: "profile" });
    expect(readJobAlertTarget({ match: "other", kind: "job" })).toEqual({
      type: "filters",
      filters: { ...NONE, kind: "job" },
    });
    expect(readJobAlertTarget(null)).toEqual({ type: "filters", filters: NONE });
  });

  it("leads to the list it follows, or to the alerts page", () => {
    expect(jobAlertHref({ type: "profile" })).toBe(JOB_ALERTS_PATH);
    expect(jobAlertHref({ type: "filters", filters: { ...NONE, kind: "freelance" } })).toBe("/jobs?kind=freelance");
    expect(jobAlertHref({ type: "filters", filters: NONE })).toBe("/jobs");
  });

  it("compares filters regardless of the page", () => {
    const page3 = parseVacancyFilters({ kind: "job", page: "3" });
    expect(sameJobAlertFilters(withoutPage(page3), { ...NONE, kind: "job" })).toBe(true);
    expect(sameJobAlertFilters({ ...NONE, kind: "job" }, { ...NONE, kind: "job", paid: true })).toBe(false);
    expect(sameJobAlertFilters({ ...NONE, q: " react " }, { ...NONE, q: "react" })).toBe(true);
  });
});

describe("describeJobAlertFilters", () => {
  const copy = dictionaries.uk;
  const labels = {
    kinds: copy.vacancies.kinds,
    formats: copy.vacancies.formats,
    levels: copy.vacancies.levels,
    paid: copy.jobAlerts.namePaid,
    everything: copy.jobAlerts.nameEverything,
  };

  it("reads like the filters a person picked", () => {
    expect(
      describeJobAlertFilters(
        { ...NONE, kind: "internship", format: "remote", level: "junior", categoryId: 7, skillId: 10, countryId: 1, q: "дизайн", paid: true },
        labels,
        { category: "Дизайн", skill: "Figma", country: "Україна" },
      ),
    ).toBe("Стажування · Віддалено · Junior · Дизайн · Figma · Україна · «дизайн» · з оплатою");
  });

  it("leaves out names it does not know and names an empty search", () => {
    expect(describeJobAlertFilters({ ...NONE, countryId: 99, kind: "job" }, labels)).toBe("Робота");
    expect(describeJobAlertFilters(NONE, labels)).toBe("Усі нові вакансії");
  });

  it("stays within the stored length", () => {
    const name = describeJobAlertFilters({ ...NONE, q: "x".repeat(80), categoryId: 1 }, labels, {
      category: "y".repeat(80),
    });
    expect(name.length).toBe(JOB_ALERT_LIMITS.nameMax);
    expect(name.endsWith("…")).toBe(true);
  });
});

describe("vacancyMatchesFilters", () => {
  it("matches with no filters at all", () => {
    expect(vacancyMatchesFilters(vacancy, NONE)).toBe(true);
  });

  it.each([
    [{ kind: "internship" }, true],
    [{ kind: "job" }, false],
    [{ format: "remote" }, true],
    [{ format: "office" }, false],
    [{ level: "junior" }, true],
    [{ level: "senior" }, false],
    [{ countryId: 1 }, true],
    [{ countryId: 2 }, false],
    [{ categoryId: 7 }, true],
    [{ categoryId: 8 }, false],
    [{ skillId: 11 }, true],
    [{ skillId: 12 }, false],
    [{ paid: true }, true],
    [{ q: "react" }, true],
    [{ q: "РОЗРОБНИК" }, true],
    [{ q: "*react*" }, true],
    [{ q: "designer" }, false],
  ] as const)("%o → %s", (patch, expected) => {
    expect(vacancyMatchesFilters(vacancy, { ...NONE, ...patch })).toBe(expected);
  });

  it("needs pay when asked for it", () => {
    expect(vacancyMatchesFilters({ ...vacancy, hasPay: false }, { ...NONE, paid: true })).toBe(false);
  });

  it("does not match a level filter against a vacancy without a level", () => {
    expect(vacancyMatchesFilters({ ...vacancy, experienceLevel: null }, { ...NONE, level: "junior" })).toBe(false);
  });
});

describe("vacancyMatchesProfile", () => {
  const profile = { openTo: ["internship", "mentoring"] as const, workFormats: ["remote"] as const, skillIds: [11, 99] };

  it("matches the kind, a shared skill and a shared format", () => {
    expect(vacancyMatchesProfile(vacancy, { ...profile, openTo: [...profile.openTo] })).toBe(true);
  });

  it("needs a kind the person is open to; mentoring is never a vacancy", () => {
    expect(vacancyMatchesProfile(vacancy, { ...profile, openTo: ["job"] })).toBe(false);
    expect(vacancyMatchesProfile(vacancy, { ...profile, openTo: ["mentoring"] })).toBe(false);
    expect(vacancyMatchesProfile(vacancy, { ...profile, openTo: [] })).toBe(false);
  });

  it("needs a shared skill only when both list some", () => {
    expect(vacancyMatchesProfile(vacancy, { openTo: ["internship"], workFormats: [], skillIds: [1, 2] })).toBe(false);
    expect(vacancyMatchesProfile(vacancy, { openTo: ["internship"], workFormats: [], skillIds: [] })).toBe(true);
    expect(
      vacancyMatchesProfile({ ...vacancy, skillIds: [] }, { openTo: ["internship"], workFormats: [], skillIds: [1] }),
    ).toBe(true);
  });

  it("needs a shared format only when both name one", () => {
    expect(vacancyMatchesProfile(vacancy, { openTo: ["internship"], workFormats: ["office"], skillIds: [] })).toBe(false);
    expect(
      vacancyMatchesProfile({ ...vacancy, workFormats: [] }, { openTo: ["internship"], workFormats: ["office"], skillIds: [] }),
    ).toBe(true);
  });

  it("knows which «Відкрито до…» options a vacancy can answer", () => {
    expect(vacancyKindsFromOpenTo(["mentoring", "freelance", "job"])).toEqual(["job", "freelance"]);
    expect(vacancyKindsFromOpenTo(["mentoring"])).toEqual([]);
  });
});

describe("vacancyLiveSince", () => {
  it("is the publication, or a later approval", () => {
    expect(vacancyLiveSince({ publishedAt: "2026-10-01T10:00:00Z", moderatedAt: null })).toBe(
      Date.parse("2026-10-01T10:00:00Z"),
    );
    expect(vacancyLiveSince({ publishedAt: "2026-10-01T10:00:00Z", moderatedAt: "2026-10-02T09:00:00Z" })).toBe(
      Date.parse("2026-10-02T09:00:00Z"),
    );
    expect(vacancyLiveSince({ publishedAt: "2026-10-01T10:00:00Z", moderatedAt: "2026-09-01T09:00:00Z" })).toBe(
      Date.parse("2026-10-01T10:00:00Z"),
    );
    expect(vacancyLiveSince({ publishedAt: "2026-10-01T10:00:00Z", moderatedAt: "garbage" })).toBe(
      Date.parse("2026-10-01T10:00:00Z"),
    );
  });

  it("is nothing for a vacancy that never went out", () => {
    expect(vacancyLiveSince({ publishedAt: null, moderatedAt: "2026-10-02T09:00:00Z" })).toBeNull();
    expect(vacancyLiveSince({ publishedAt: "nope", moderatedAt: null })).toBeNull();
  });
});

describe("jobAlertWriteErrorCode", () => {
  it("maps the database's refusals", () => {
    expect(jobAlertWriteErrorCode(null)).toBeNull();
    expect(jobAlertWriteErrorCode({ message: "job_alert_limit_reached" })).toBe("limit");
    expect(jobAlertWriteErrorCode({ code: "23505", message: "duplicate key" })).toBe("duplicate");
    expect(jobAlertWriteErrorCode({ message: 'violates "saved_searches_vacancies_unique"' })).toBe("duplicate");
    expect(jobAlertWriteErrorCode({ code: "23514", message: "check" })).toBe("invalid");
    expect(jobAlertWriteErrorCode({})).toBe("invalid");
  });
});
