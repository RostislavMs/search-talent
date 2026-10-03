import { describe, expect, it } from "vitest";
import {
  applicationStatusSchema,
  applyToVacancySchema,
  markApplicationsViewedSchema,
  routeApplicationIdSchema,
} from "@/lib/validation/applications";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const P3 = "33333333-3333-4333-8333-333333333333";
const P4 = "44444444-4444-4444-8444-444444444444";

describe("applyToVacancySchema", () => {
  it("accepts projects, a message and the consent, trimming the message", () => {
    const parsed = applyToVacancySchema.parse({ project_ids: [P1, P2], message: "  Hi  ", consent: true });
    expect(parsed).toEqual({ project_ids: [P1, P2], message: "Hi", consent: true });
  });

  it("treats a missing message as empty", () => {
    expect(applyToVacancySchema.parse({ project_ids: [P1], consent: true }).message).toBe("");
    expect(applyToVacancySchema.parse({ project_ids: [P1], message: null, consent: true }).message).toBe("");
  });

  it("drops repeated projects, keeping the order", () => {
    expect(applyToVacancySchema.parse({ project_ids: [P2, P1, P2, P1, P3], consent: true }).project_ids).toEqual([
      P2,
      P1,
      P3,
    ]);
  });

  it("needs 1 to 3 projects", () => {
    expect(applyToVacancySchema.safeParse({ project_ids: [], consent: true }).success).toBe(false);
    expect(applyToVacancySchema.safeParse({ project_ids: [P1, P2, P3, P4], consent: true }).success).toBe(false);
    expect(applyToVacancySchema.safeParse({ consent: true }).success).toBe(false);
  });

  it("refuses ids that are not uuids", () => {
    expect(applyToVacancySchema.safeParse({ project_ids: ["nope"], consent: true }).success).toBe(false);
  });

  it("caps the message at 1 000 characters after trimming", () => {
    expect(applyToVacancySchema.safeParse({ project_ids: [P1], message: "x".repeat(1000), consent: true }).success).toBe(
      true,
    );
    expect(
      applyToVacancySchema.safeParse({ project_ids: [P1], message: ` ${"x".repeat(1000)} `, consent: true }).success,
    ).toBe(true);
    expect(applyToVacancySchema.safeParse({ project_ids: [P1], message: "x".repeat(1001), consent: true }).success).toBe(
      false,
    );
  });

  it("requires the consent to be true", () => {
    expect(applyToVacancySchema.safeParse({ project_ids: [P1] }).success).toBe(false);
    expect(applyToVacancySchema.safeParse({ project_ids: [P1], consent: false }).success).toBe(false);
    expect(applyToVacancySchema.safeParse({ project_ids: [P1], consent: "yes" }).success).toBe(false);
  });
});

describe("the other application schemas", () => {
  it("lets the team set four statuses only", () => {
    for (const status of ["viewed", "shortlisted", "rejected", "hired"]) {
      expect(applicationStatusSchema.safeParse({ status }).success).toBe(true);
    }
    for (const status of ["new", "withdrawn", "", null]) {
      expect(applicationStatusSchema.safeParse({ status }).success).toBe(false);
    }
  });

  it("marks 1 to 200 applications viewed at a time, each once", () => {
    expect(markApplicationsViewedSchema.parse({ ids: [P1, P1, P2] }).ids).toEqual([P1, P2]);
    expect(markApplicationsViewedSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(markApplicationsViewedSchema.safeParse({ ids: Array(201).fill(P1) }).success).toBe(false);
    expect(markApplicationsViewedSchema.safeParse({ ids: ["x"] }).success).toBe(false);
  });

  it("checks the route id", () => {
    expect(routeApplicationIdSchema.safeParse({ id: P1 }).success).toBe(true);
    expect(routeApplicationIdSchema.safeParse({ id: "1" }).success).toBe(false);
  });
});
