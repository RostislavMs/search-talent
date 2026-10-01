import { describe, expect, it } from "vitest";
import {
  REPORT_TARGETS,
  bulkModerationTargetTypes,
  reportHoldsTarget,
  reportReasons,
  reportTargetColumns,
  reportTargetTypes,
} from "@/lib/moderation";

describe("REPORT_TARGETS", () => {
  it("maps every report target to its own table and column", () => {
    expect(Object.keys(REPORT_TARGETS).sort()).toEqual([...reportTargetTypes].sort());
    expect(REPORT_TARGETS).toEqual({
      profile: { table: "profiles", column: "target_profile_id" },
      project: { table: "projects", column: "target_project_id" },
      article: { table: "articles", column: "target_article_id" },
      company: { table: "companies", column: "target_company_id" },
      vacancy: { table: "vacancies", column: "target_vacancy_id" },
    });
  });

  it("never sends two targets to one column or table", () => {
    const entries = Object.values(REPORT_TARGETS);
    expect(new Set(entries.map((entry) => entry.table)).size).toBe(entries.length);
    expect(new Set(entries.map((entry) => entry.column)).size).toBe(entries.length);
  });
});

describe("reportTargetColumns", () => {
  it.each(reportTargetTypes)("writes only the %s column", (type) => {
    expect(reportTargetColumns(type, "id-1")).toEqual({ [REPORT_TARGETS[type].column]: "id-1" });
  });
});

describe("reportHoldsTarget", () => {
  it("holds a vacancy on a scam report", () => {
    expect(reportHoldsTarget("vacancy", "spam_or_scam")).toBe(true);
  });

  it("holds anything on an urgent reason", () => {
    for (const type of reportTargetTypes) {
      for (const reason of ["sexual_content", "harmful_or_dangerous", "harassment_or_hate"] as const) {
        expect(reportHoldsTarget(type, reason)).toBe(true);
      }
    }
  });

  it("does not hold other targets on a scam report, nor anything on a calm reason", () => {
    for (const type of ["profile", "project", "article", "company"] as const) {
      expect(reportHoldsTarget(type, "spam_or_scam")).toBe(false);
    }
    const calm = reportReasons.filter(
      (reason) => !["sexual_content", "harmful_or_dangerous", "harassment_or_hate", "spam_or_scam"].includes(reason),
    );
    for (const reason of calm) {
      expect(reportHoldsTarget("vacancy", reason)).toBe(false);
    }
  });
});

describe("bulkModerationTargetTypes", () => {
  it("leaves companies and vacancies to their own admin tables", () => {
    expect(bulkModerationTargetTypes).toEqual(["profile", "project", "article"]);
  });
});
