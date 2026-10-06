import { describe, expect, it } from "vitest";
import {
  isCommentReportTarget,
  isPublicModerationStatus,
  normalizeModerationStatus,
  reportTargetTypes,
} from "@/lib/moderation";

describe("normalizeModerationStatus", () => {
  it("returns the value when it is a known status", () => {
    expect(normalizeModerationStatus("approved")).toBe("approved");
    expect(normalizeModerationStatus("removed")).toBe("removed");
  });

  it("returns null for unknown or empty values", () => {
    expect(normalizeModerationStatus("foo")).toBeNull();
    expect(normalizeModerationStatus(null)).toBeNull();
    expect(normalizeModerationStatus(undefined)).toBeNull();
    expect(normalizeModerationStatus("")).toBeNull();
  });
});

describe("isPublicModerationStatus", () => {
  it("treats null/undefined as public (item never moderated)", () => {
    expect(isPublicModerationStatus(null)).toBe(true);
    expect(isPublicModerationStatus(undefined)).toBe(true);
  });

  it("treats only 'approved' as public", () => {
    expect(isPublicModerationStatus("approved")).toBe(true);
    expect(isPublicModerationStatus("under_review")).toBe(false);
    expect(isPublicModerationStatus("restricted")).toBe(false);
    expect(isPublicModerationStatus("removed")).toBe(false);
  });

  it("treats invalid status values as public (fail-open for unknown)", () => {
    expect(isPublicModerationStatus("bogus")).toBe(true);
  });
});

// Report priority, holds and the action names in the log are the database's
// now (prepare_content_report, hold_reported_content, moderation_action_type in
// database/2026-10-06-moderation-in-db.sql), checked by its own test run.

describe("isCommentReportTarget", () => {
  it("is true for the three comment targets only", () => {
    expect(reportTargetTypes.filter(isCommentReportTarget)).toEqual([
      "project_comment",
      "article_comment",
      "poll_comment",
    ]);
  });
});
