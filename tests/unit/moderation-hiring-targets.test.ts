import { describe, expect, it } from "vitest";
import {
  REPORT_TARGETS,
  bulkModerationTargetTypes,
  commentReportTargetTypes,
  reportTargetTypes,
} from "@/lib/moderation";

describe("REPORT_TARGETS", () => {
  it("maps every report target to its own table and column", () => {
    expect(Object.keys(REPORT_TARGETS).sort()).toEqual([...reportTargetTypes].sort());
    expect(REPORT_TARGETS).toEqual({
      profile: { table: "profiles", column: "target_profile_id" },
      project: { table: "projects", column: "target_project_id" },
      article: { table: "articles", column: "target_article_id" },
      poll: { table: "polls", column: "target_poll_id" },
      company: { table: "companies", column: "target_company_id" },
      vacancy: { table: "vacancies", column: "target_vacancy_id" },
      project_comment: { table: "project_comments", column: "target_comment_id" },
      article_comment: { table: "article_comments", column: "target_comment_id" },
      poll_comment: { table: "poll_comments", column: "target_comment_id" },
    });
  });

  it("never sends two targets to one table, and only comments share a column", () => {
    const entries = Object.values(REPORT_TARGETS);
    expect(new Set(entries.map((entry) => entry.table)).size).toBe(entries.length);

    const columns = Object.entries(REPORT_TARGETS)
      .filter(([type]) => !(commentReportTargetTypes as readonly string[]).includes(type))
      .map(([, entry]) => entry.column);
    expect(new Set(columns).size).toBe(columns.length);
    expect(columns).not.toContain("target_comment_id");
  });
});

describe("bulkModerationTargetTypes", () => {
  it("leaves companies and vacancies to their own admin tables", () => {
    expect(bulkModerationTargetTypes).toEqual(["profile", "project", "article"]);
  });
});
