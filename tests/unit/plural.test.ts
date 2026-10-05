import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { formatCount, formatScore } from "@/lib/plural";

describe("formatScore", () => {
  const uk = dictionaries.uk.common;
  const en = dictionaries.en.common;

  it("declines «бал» by the number in Ukrainian", () => {
    expect(formatScore(1, uk)).toBe("1 бал");
    expect(formatScore(21, uk)).toBe("21 бал");
    expect(formatScore(31, uk)).toBe("31 бал");
    expect(formatScore(2, uk)).toBe("2 бали");
    expect(formatScore(34, uk)).toBe("34 бали");
    expect(formatScore(52, uk)).toBe("52 бали");
    expect(formatScore(5, uk)).toBe("5 балів");
    expect(formatScore(11, uk)).toBe("11 балів");
    expect(formatScore(25, uk)).toBe("25 балів");
    expect(formatScore(0, uk)).toBe("0 балів");
  });

  it("uses point / points in English", () => {
    expect(formatScore(1, en)).toBe("1 point");
    expect(formatScore(34, en)).toBe("34 points");
    expect(formatScore(0, en)).toBe("0 points");
  });

  it("formats a fractional score with the «other» form", () => {
    expect(formatScore(1.5, uk)).toBe(`${new Intl.NumberFormat("uk-UA").format(1.5)} бала`);
  });
});

describe("project count", () => {
  it("declines «проєкт» by the number", () => {
    const { projectCount, pluralLocale } = dictionaries.uk.common;
    expect(formatCount(1, projectCount, pluralLocale)).toBe("1 проєкт");
    expect(formatCount(21, projectCount, pluralLocale)).toBe("21 проєкт");
    expect(formatCount(3, projectCount, pluralLocale)).toBe("3 проєкти");
    expect(formatCount(8, projectCount, pluralLocale)).toBe("8 проєктів");
  });

  it("uses project / projects in English", () => {
    const { projectCount, pluralLocale } = dictionaries.en.common;
    expect(formatCount(1, projectCount, pluralLocale)).toBe("1 project");
    expect(formatCount(21, projectCount, pluralLocale)).toBe("21 projects");
  });
});

describe("formatCount", () => {
  it("is still exported from vacancies for older callers", async () => {
    const vacancies = await import("@/lib/vacancies");
    expect(vacancies.formatCount).toBe(formatCount);
  });
});
