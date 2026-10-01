import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { VacancySummary } from "@/lib/vacancies";
import {
  formatVacancyDate,
  vacancyFactsLine,
  vacancyPayLabel,
  vacancyPlaceLabel,
} from "@/lib/vacancy-presentation";

const en = dictionaries.en.vacancies;
const uk = dictionaries.uk.vacancies;

function vacancy(patch: Partial<VacancySummary> = {}): VacancySummary {
  return {
    id: "v1",
    slug: "junior-designer-abc123",
    title: "Junior designer",
    kind: "job",
    hours: null,
    workFormats: [],
    city: null,
    countryName: null,
    experienceLevel: null,
    categoryName: null,
    pay: null,
    locale: "en",
    status: "published",
    state: "open",
    moderationStatus: "approved",
    publishedAt: "2026-09-30T12:00:00Z",
    expiresAt: "2026-11-29T12:00:00Z",
    company: {
      id: "c1",
      slug: "acme",
      name: "Acme",
      logoUrl: null,
      verified: true,
      moderationStatus: "approved",
    },
    ...patch,
  };
}

describe("vacancyPlaceLabel", () => {
  it("names the place when there is one", () => {
    expect(vacancyPlaceLabel(vacancy({ city: "Kyiv", countryName: "Ukraine", workFormats: ["remote"] }), en)).toBe(
      "Kyiv, Ukraine",
    );
    expect(vacancyPlaceLabel(vacancy({ countryName: "Poland" }), en)).toBe("Poland");
  });

  it("says remote for remote-only work without a place", () => {
    expect(vacancyPlaceLabel(vacancy({ workFormats: ["remote"] }), en)).toBe("Remote");
    expect(vacancyPlaceLabel(vacancy({ workFormats: ["remote"] }), uk)).toBe("Віддалено");
  });

  it("says nothing when nothing is known", () => {
    expect(vacancyPlaceLabel(vacancy({ workFormats: ["remote", "hybrid"] }), en)).toBeNull();
    expect(vacancyPlaceLabel(vacancy({ workFormats: ["office"] }), en)).toBeNull();
    expect(vacancyPlaceLabel(vacancy(), en)).toBeNull();
  });
});

describe("vacancyFactsLine", () => {
  it("lists kind, hours, formats and place in that order", () => {
    const line = vacancyFactsLine(
      vacancy({ kind: "internship", hours: "part_time", workFormats: ["remote", "hybrid"], city: "Kyiv" }),
      en,
    );
    expect(line).toBe("Internship · Part time · Remote, hybrid · Kyiv");
  });

  it("reads the same in Ukrainian", () => {
    const line = vacancyFactsLine(
      vacancy({ kind: "job", hours: "full_time", workFormats: ["remote", "office"], city: "Київ", countryName: "Україна" }),
      uk,
    );
    expect(line).toBe("Робота · Повна зайнятість · Віддалено, в офісі · Київ, Україна");
  });

  it("leaves hours out for kinds that have none", () => {
    expect(vacancyFactsLine(vacancy({ kind: "freelance", hours: "part_time" }), en)).toBe("Freelance");
    expect(vacancyFactsLine(vacancy({ kind: "collaboration", hours: "full_time", workFormats: ["office"] }), en)).toBe(
      "Collaboration · Office",
    );
  });

  it("is just the kind when nothing else is known", () => {
    expect(vacancyFactsLine(vacancy(), en)).toBe("Job");
  });
});

describe("vacancyPayLabel", () => {
  it("formats the pay or says nothing", () => {
    expect(vacancyPayLabel(vacancy(), en, "en")).toBeNull();
    expect(
      vacancyPayLabel(vacancy({ pay: { min: 15, max: 25, currency: "usd", period: "hour" } }), en, "en"),
    ).toBe("15–25 USD per hour");
    expect(
      vacancyPayLabel(vacancy({ pay: { min: 900, max: 900, currency: "eur", period: "project" } }), uk, "uk"),
    ).toBe("900 EUR за проєкт");
  });
});

describe("formatVacancyDate", () => {
  it("writes a long date in the locale", () => {
    expect(formatVacancyDate("2026-09-30T12:00:00Z", "en")).toBe("September 30, 2026");
    const ukDate = formatVacancyDate("2026-09-30T12:00:00Z", "uk");
    expect(ukDate).toBe(
      new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" }).format(
        new Date("2026-09-30T12:00:00Z"),
      ),
    );
    expect(ukDate).toContain("вересня");
  });

  it("is null for nothing or nonsense", () => {
    expect(formatVacancyDate(null, "en")).toBeNull();
    expect(formatVacancyDate("", "en")).toBeNull();
    expect(formatVacancyDate("not a date", "uk")).toBeNull();
  });
});
