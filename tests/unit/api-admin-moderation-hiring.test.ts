import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

vi.mock("@/lib/moderation-server", () => ({ getCurrentViewerRole: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));
vi.mock("@/lib/db/notifications", () => ({ createNotifications: vi.fn() }));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({
  buildModerationDecisionEmail: vi.fn(() => ({ subject: "", html: "", text: "" })),
}));
vi.mock("@/lib/db/companies", () => ({ notifyCompanyModeration: vi.fn(async () => undefined) }));
vi.mock("@/lib/db/vacancies", () => ({
  notifyVacancyApproved: vi.fn(async () => undefined),
  notifyVacancyModeration: vi.fn(async () => undefined),
}));

import { POST } from "@/app/api/admin/moderation/route";
import { notifyCompanyModeration } from "@/lib/db/companies";
import { notifyVacancyApproved, notifyVacancyModeration } from "@/lib/db/vacancies";
import { getCurrentViewerRole } from "@/lib/moderation-server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const VACANCY_ID = "33333333-3333-4333-8333-333333333333";
const REPORT_ID = "44444444-4444-4444-8444-444444444444";

const adminUser: MockUser = { id: ADMIN_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function viewer(previous: string | null, resolve?: (call: QueryCall) => QueryResult): SupabaseMock {
  const mock = createSupabaseMock({
    user: adminUser,
    resolve:
      resolve ??
      ((call) =>
        call.verb === "select" && (call.table === "vacancies" || call.table === "companies")
          ? { data: { id: call.table === "vacancies" ? VACANCY_ID : COMPANY_ID, moderation_status: previous } }
          : {}),
  });
  vi.mocked(getCurrentViewerRole).mockResolvedValue({
    user: adminUser as never,
    isAdmin: true,
    supabase: mock.client as never,
  } as never);
  return mock;
}

function req(body: Record<string, unknown>): Request {
  return new Request("http://test/api/admin/moderation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const vacancy = (moderationStatus: string, extra: Record<string, unknown> = {}) => ({
  targetType: "vacancy",
  targetId: VACANCY_ID,
  moderationStatus,
  ...extra,
});
const company = (moderationStatus: string) => ({ targetType: "company", targetId: COMPANY_ID, moderationStatus });

afterEach(() => vi.clearAllMocks());

describe("moderating a vacancy", () => {
  it("updates the vacancy and logs the action against its column", async () => {
    const mock = viewer("under_review");
    const res = await POST(req(vacancy("approved", { resolutionNote: " looks fine " })));
    expect(res.status).toBe(200);

    expect(mock.calls[0]).toMatchObject({ table: "vacancies", verb: "select" });
    const update = mock.calls.find((call) => call.table === "vacancies" && call.verb === "update");
    expect(update?.payload).toMatchObject({
      moderation_status: "approved",
      moderation_note: "looks fine",
      moderated_by: ADMIN_ID,
    });
    expect(update?.filters).toEqual([{ method: "eq", args: ["id", VACANCY_ID] }]);

    const action = mock.calls.find((call) => call.table === "moderation_actions" && call.verb === "insert");
    expect(action?.payload).toEqual({
      actor_user_id: ADMIN_ID,
      report_id: null,
      target_type: "vacancy",
      target_vacancy_id: VACANCY_ID,
      previous_status: "under_review",
      next_status: "approved",
      report_status: null,
      action_type: "approve",
      note: "looks fine",
    });
    expect(mock.calls.some((call) => call.table === "projects")).toBe(false);
  });

  it("tells the team when a held vacancy is let out", async () => {
    viewer("under_review");
    await POST(req(vacancy("approved")));
    expect(notifyVacancyApproved).toHaveBeenCalledWith(VACANCY_ID);
    expect(notifyVacancyModeration).not.toHaveBeenCalled();
  });

  it("stays quiet when approving what was not in review", async () => {
    viewer("approved");
    await POST(req(vacancy("approved")));
    viewer("removed");
    await POST(req(vacancy("approved")));
    expect(notifyVacancyApproved).not.toHaveBeenCalled();
    expect(notifyVacancyModeration).not.toHaveBeenCalled();
  });

  it.each(["removed", "restricted"])("tells the team when the vacancy is %s", async (status) => {
    viewer("approved");
    expect((await POST(req(vacancy(status)))).status).toBe(200);
    expect(notifyVacancyModeration).toHaveBeenCalledWith({ vacancyId: VACANCY_ID, status });
    expect(notifyVacancyApproved).not.toHaveBeenCalled();
    // Vacancies have their own recipients; the generic owner path is not used.
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("does not repeat a decision that did not change", async () => {
    viewer("restricted");
    await POST(req(vacancy("restricted")));
    viewer("approved");
    await POST(req(vacancy("under_review")));
    expect(notifyVacancyModeration).not.toHaveBeenCalled();
    expect(notifyVacancyApproved).not.toHaveBeenCalled();
  });

  it("closes the report it came from", async () => {
    const mock = viewer("under_review");
    await POST(req(vacancy("removed", { reportId: REPORT_ID, reportStatus: "resolved" })));
    const report = mock.calls.find((call) => call.table === "content_reports" && call.verb === "update");
    expect(report?.payload).toMatchObject({ status: "resolved", reviewed_by: ADMIN_ID });
    expect(report?.filters).toEqual([{ method: "eq", args: ["id", REPORT_ID] }]);
    const action = mock.calls.find((call) => call.table === "moderation_actions");
    expect(action?.payload).toMatchObject({ report_id: REPORT_ID, report_status: "resolved", action_type: "remove" });
  });

  it("does not fail the decision when the notification fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    viewer("approved");
    vi.mocked(notifyVacancyModeration).mockRejectedValueOnce(new Error("no service key"));
    expect((await POST(req(vacancy("removed")))).status).toBe(200);
    spy.mockRestore();
  });

  it("404 when the vacancy is gone", async () => {
    viewer(null, () => ({ data: null }));
    expect((await POST(req(vacancy("removed")))).status).toBe(404);
    expect(notifyVacancyModeration).not.toHaveBeenCalled();
  });
});

describe("moderating a company page", () => {
  it("tells the managers when the page is restricted", async () => {
    const mock = viewer("approved");
    expect((await POST(req(company("restricted")))).status).toBe(200);
    expect(notifyCompanyModeration).toHaveBeenCalledWith({ companyId: COMPANY_ID, status: "restricted" });

    const action = mock.calls.find((call) => call.table === "moderation_actions");
    expect(action?.payload).toMatchObject({
      target_type: "company",
      target_company_id: COMPANY_ID,
      action_type: "restrict",
    });
    expect(action?.payload).not.toHaveProperty("target_vacancy_id");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("stays quiet for an unchanged decision or an approval", async () => {
    viewer("removed");
    await POST(req(company("removed")));
    viewer("under_review");
    await POST(req(company("approved")));
    expect(notifyCompanyModeration).not.toHaveBeenCalled();
    expect(notifyVacancyApproved).not.toHaveBeenCalled();
  });
});

describe("other content still goes to its owner", () => {
  it("uses the generic owner notification for a project", async () => {
    viewer(null, (call) =>
      call.table === "projects" && call.verb === "select"
        ? { data: { id: VACANCY_ID, moderation_status: "approved" } }
        : {},
    );
    await POST(req({ targetType: "project", targetId: VACANCY_ID, moderationStatus: "removed" }));
    expect(createAdminClient).toHaveBeenCalled();
    expect(notifyVacancyModeration).not.toHaveBeenCalled();
    expect(notifyCompanyModeration).not.toHaveBeenCalled();
  });
});
