import { describe, expect, it } from "vitest";
import {
  VACANCY_STATUS_ACTIONS,
  createVacancySchema,
  routeVacancyIdSchema,
  vacancyPayloadSchema,
  vacancyReadinessIssues,
  vacancyStatusActionSchema,
} from "@/lib/validation/vacancies";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const longText = "We are looking for a junior frontend developer to build interfaces with React and TypeScript.";

const valid = {
  title: "  Junior frontend developer ",
  description: `<p>${longText}</p>`,
  kind: "job",
  hours: "full_time",
  work_formats: ["office", "remote", "office"],
  country_id: 3,
  city: " Kyiv ",
  experience_level: "junior",
  category_id: 7,
  pay: { min: 20_000, max: 30_000, currency: "uah", period: "month" },
  locale: "en",
  skill_ids: [5, 3, 5],
  status: "published",
};

type Issue = { message: string; path: PropertyKey[]; code?: string; errors?: Issue[][] };

/**
 * Every issue with its full path, including the ones Zod 4 tucks inside an
 * `invalid_union` (the optional pay is a union with null/undefined, and its
 * transform keeps Zod from surfacing the inner issue on its own).
 */
function allIssues(issues: Issue[], prefix: PropertyKey[] = []): Array<{ message: string; path: PropertyKey[] }> {
  return issues.flatMap((issue) => {
    const path = [...prefix, ...issue.path];
    if (issue.code === "invalid_union" && issue.errors) {
      return issue.errors.flatMap((branch) => allIssues(branch, path));
    }
    return [{ message: issue.message, path }];
  });
}

function messages(result: { success: boolean; error?: { issues: unknown[] } }) {
  return allIssues((result.error?.issues ?? []) as Issue[]).map((issue) => issue.message);
}

describe("vacancyPayloadSchema", () => {
  it("trims, orders formats and drops repeated skills", () => {
    expect(vacancyPayloadSchema.parse(valid)).toEqual({
      title: "Junior frontend developer",
      description: `<p>${longText}</p>`,
      kind: "job",
      hours: "full_time",
      work_formats: ["remote", "office"],
      country_id: 3,
      city: "Kyiv",
      experience_level: "junior",
      category_id: 7,
      pay: { min: 20_000, max: 30_000, currency: "uah", period: "month" },
      locale: "en",
      skill_ids: [5, 3],
      status: "published",
    });
  });

  it("fills in the defaults and turns empty fields into null", () => {
    const parsed = vacancyPayloadSchema.parse({
      title: "Designer",
      kind: "job",
      hours: "",
      experience_level: "",
      city: "   ",
      country_id: null,
      category_id: undefined,
      pay: null,
    });
    expect(parsed).toEqual({
      title: "Designer",
      description: "",
      kind: "job",
      hours: null,
      work_formats: [],
      country_id: null,
      city: null,
      experience_level: null,
      category_id: null,
      pay: null,
      locale: "uk",
      skill_ids: [],
      status: "draft",
    });
  });

  it("turns an amount without an upper end into an exact amount", () => {
    const parsed = vacancyPayloadSchema.parse({
      ...valid,
      pay: { min: 15, max: null, currency: "usd", period: "hour" },
    });
    expect(parsed.pay).toEqual({ min: 15, max: 15, currency: "usd", period: "hour" });
    const omitted = vacancyPayloadSchema.parse({ ...valid, pay: { min: 15, currency: "usd", period: "hour" } });
    expect(omitted.pay).toEqual({ min: 15, max: 15, currency: "usd", period: "hour" });
  });

  it("drops hours for kinds without them", () => {
    const parsed = vacancyPayloadSchema.parse({
      ...valid,
      kind: "freelance",
      hours: "full_time",
      pay: { min: 500, max: null, currency: "usd", period: "project" },
    });
    expect(parsed.hours).toBeNull();
    expect(vacancyPayloadSchema.parse({ ...valid, kind: "collaboration", hours: "part_time" }).hours).toBeNull();
    expect(vacancyPayloadSchema.parse({ ...valid, kind: "internship", hours: "part_time" }).hours).toBe("part_time");
  });

  it("does not take server-owned columns", () => {
    const parsed = vacancyPayloadSchema.parse({
      ...valid,
      slug: "mine",
      moderation_status: "approved",
      expires_at: "2099-01-01T00:00:00Z",
      published_at: "2020-01-01T00:00:00Z",
      author_user_id: "someone",
    });
    for (const key of ["slug", "moderation_status", "expires_at", "published_at", "author_user_id"]) {
      expect(parsed).not.toHaveProperty(key);
    }
  });

  it.each([
    [{ title: "ab" }, "Title is too short"],
    [{ title: "x".repeat(121) }, "Title is too long"],
    [{ description: "x".repeat(20_001) }, "Description is too long"],
    [{ city: "x".repeat(81) }, "City is too long"],
    [{ pay: { min: 0, max: null, currency: "uah", period: "month" } }, "Pay is too small"],
    [{ pay: { min: 1.5, max: null, currency: "uah", period: "month" } }, "Pay must be a whole number"],
    [{ pay: { min: 100_000_001, max: null, currency: "uah", period: "month" } }, "Pay is too large"],
    [{ pay: { min: 30_000, max: 20_000, currency: "uah", period: "month" } }, "The upper end is below the lower one"],
    [{ pay: { min: 500, max: null, currency: "uah", period: "project" } }, "This kind of vacancy is not paid that way"],
    [{ skill_ids: Array.from({ length: 16 }, (_, i) => i + 1) }, "Too many skills"],
  ])("rejects %o", (patch, message) => {
    const result = vacancyPayloadSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    expect(messages(result)).toContain(message);
  });

  it("points the pay errors at their fields", () => {
    const range = vacancyPayloadSchema.safeParse({
      ...valid,
      pay: { min: 30_000, max: 20_000, currency: "uah", period: "month" },
    });
    expect(allIssues(range.error!.issues as Issue[])).toContainEqual({
      message: "The upper end is below the lower one",
      path: ["pay", "max"],
    });
    const period = vacancyPayloadSchema.safeParse({
      ...valid,
      kind: "freelance",
      pay: { min: 30_000, max: null, currency: "uah", period: "month" },
    });
    expect(period.error?.issues[0]?.path).toEqual(["pay", "period"]);
  });

  it("puts the pay reason first, where the API reads it (not a bare 'Invalid input')", () => {
    const tooSmall = vacancyPayloadSchema.safeParse({
      ...valid,
      pay: { min: 0, max: null, currency: "uah", period: "month" },
    });
    expect(tooSmall.error?.issues[0]?.message).toBe("Pay is too small");

    const upsideDown = vacancyPayloadSchema.safeParse({
      ...valid,
      pay: { min: 30_000, max: 20_000, currency: "uah", period: "month" },
    });
    expect(upsideDown.error?.issues[0]).toMatchObject({
      message: "The upper end is below the lower one",
      path: ["pay", "max"],
    });
  });

  it("allows only the known values", () => {
    for (const patch of [
      { kind: "mentoring" },
      { hours: "weekends" },
      { work_formats: ["space"] },
      { experience_level: "guru" },
      { locale: "de" },
      { status: "closed" },
      { status: "expired" },
      { country_id: -1 },
      { country_id: "3" },
      { skill_ids: [0] },
      { pay: { min: 100, max: null, currency: "gbp", period: "month" } },
      { pay: { min: 100, max: null, currency: "uah", period: "week" } },
    ]) {
      expect(vacancyPayloadSchema.safeParse({ ...valid, ...patch }).success, JSON.stringify(patch)).toBe(false);
    }
  });
});

describe("createVacancySchema", () => {
  it("needs the company and keeps the parsed vacancy", () => {
    const parsed = createVacancySchema.parse({ ...valid, company_id: COMPANY_ID });
    expect(parsed).toMatchObject({
      company_id: COMPANY_ID,
      title: "Junior frontend developer",
      work_formats: ["remote", "office"],
      skill_ids: [5, 3],
      hours: "full_time",
    });
  });

  it("refuses a missing or bad company id", () => {
    expect(createVacancySchema.safeParse(valid).success).toBe(false);
    const bad = createVacancySchema.safeParse({ ...valid, company_id: "nope" });
    expect(bad.success).toBe(false);
    expect(messages(bad)).toContain("Invalid identifier");
  });
});

describe("vacancyReadinessIssues", () => {
  const pay = { min: 100, max: 100, currency: "usd" as const, period: "month" as const };

  it("passes a complete vacancy", () => {
    expect(vacancyReadinessIssues({ kind: "job", description: `<p>${longText}</p>`, pay })).toEqual([]);
  });

  it("counts only the text, not the markup", () => {
    const tags = `<p><strong>${"x".repeat(79)}</strong></p>`;
    expect(vacancyReadinessIssues({ kind: "freelance", description: tags, pay: null })).toEqual([
      "description_short",
    ]);
    expect(
      vacancyReadinessIssues({ kind: "freelance", description: `<p>${"x".repeat(80)}</p>`, pay: null }),
    ).toEqual([]);
  });

  it("wants pay for a job or an internship only", () => {
    const description = `<p>${longText}</p>`;
    expect(vacancyReadinessIssues({ kind: "job", description, pay: null })).toEqual(["pay_required"]);
    expect(vacancyReadinessIssues({ kind: "internship", description, pay: null })).toEqual(["pay_required"]);
    expect(vacancyReadinessIssues({ kind: "freelance", description, pay: null })).toEqual([]);
    expect(vacancyReadinessIssues({ kind: "collaboration", description, pay: null })).toEqual([]);
  });

  it("lists the description first", () => {
    expect(vacancyReadinessIssues({ kind: "job", description: "", pay: null })).toEqual([
      "description_short",
      "pay_required",
    ]);
  });
});

describe("route and status schemas", () => {
  it("knows three actions", () => {
    expect(VACANCY_STATUS_ACTIONS).toEqual(["publish", "close", "extend"]);
    for (const action of VACANCY_STATUS_ACTIONS) {
      expect(vacancyStatusActionSchema.safeParse({ action }).success).toBe(true);
    }
    expect(vacancyStatusActionSchema.safeParse({ action: "delete" }).success).toBe(false);
    expect(vacancyStatusActionSchema.safeParse({}).success).toBe(false);
  });

  it("wants a uuid in the address", () => {
    expect(routeVacancyIdSchema.safeParse({ id: COMPANY_ID }).success).toBe(true);
    expect(routeVacancyIdSchema.safeParse({ id: "junior-designer" }).success).toBe(false);
  });
});
