import { describe, expect, it } from "vitest";
import {
  getModerationActionType,
  getReportPriority,
  isPublicModerationStatus,
  normalizeModerationStatus,
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

describe("getReportPriority", () => {
  it("flags safety reports as urgent", () => {
    expect(getReportPriority("sexual_content")).toBe("urgent");
    expect(getReportPriority("harmful_or_dangerous")).toBe("urgent");
    expect(getReportPriority("harassment_or_hate")).toBe("urgent");
  });

  it("flags legal/identity reports as high", () => {
    expect(getReportPriority("copyright_infringement")).toBe("high");
    expect(getReportPriority("impersonation")).toBe("high");
    expect(getReportPriority("spam_or_scam")).toBe("high");
  });

  it("falls back to normal priority for the catch-all reasons", () => {
    expect(getReportPriority("inappropriate_content")).toBe("normal");
    expect(getReportPriority("other")).toBe("normal");
  });
});

describe("getModerationActionType", () => {
  it("returns confirm_approved when re-approving an already approved item", () => {
    expect(getModerationActionType("approved", "approved")).toBe("confirm_approved");
  });

  it("returns update_status when re-applying the same non-approved status", () => {
    expect(getModerationActionType("removed", "removed")).toBe("update_status");
  });

  it("returns restore when approving content previously removed or restricted", () => {
    expect(getModerationActionType("removed", "approved")).toBe("restore");
    expect(getModerationActionType("restricted", "approved")).toBe("restore");
  });

  it("returns approve when approving content with no prior moderation action", () => {
    expect(getModerationActionType(null, "approved")).toBe("approve");
    expect(getModerationActionType("under_review", "approved")).toBe("approve");
  });

  it("returns the matching action for each non-approved target status", () => {
    expect(getModerationActionType("approved", "under_review")).toBe("send_to_review");
    expect(getModerationActionType("approved", "restricted")).toBe("restrict");
    expect(getModerationActionType("approved", "removed")).toBe("remove");
  });
});
