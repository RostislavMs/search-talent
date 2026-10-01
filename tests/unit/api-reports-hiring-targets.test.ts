import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/db/companies", () => ({
  getCompanyRole: vi.fn(async () => null),
  holdCompanyForReview: vi.fn(async () => true),
}));
vi.mock("@/lib/db/vacancies", () => ({ holdVacancyForReview: vi.fn(async () => true) }));

import { POST } from "@/app/api/reports/route";
import { getCompanyRole, holdCompanyForReview } from "@/lib/db/companies";
import { holdVacancyForReview } from "@/lib/db/vacancies";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const AUTHOR_ID = "99999999-9999-4999-8999-999999999999";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const VACANCY_ID = "33333333-3333-4333-8333-333333333333";
const AUTO_REVIEW_NOTE = "Moved to review automatically after an urgent community report.";

const reporter: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

type Rows = {
  vacancy?: Record<string, unknown> | null;
  company?: Record<string, unknown> | null;
  duplicate?: unknown;
  insertError?: unknown;
};

function setMock({
  vacancy = { id: VACANCY_ID, author_user_id: AUTHOR_ID, company_id: COMPANY_ID, moderation_status: "approved" },
  company = { id: COMPANY_ID, created_by: AUTHOR_ID, moderation_status: "approved" },
  duplicate = null,
  insertError = null,
}: Rows = {}) {
  holder.mock = createSupabaseMock({
    user: reporter,
    resolve: (call: QueryCall): QueryResult => {
      if (call.table === "vacancies" && call.verb === "select") return { data: vacancy };
      if (call.table === "companies" && call.verb === "select") return { data: company };
      if (call.table === "content_reports" && call.verb === "select") return { data: duplicate };
      if (call.table === "content_reports" && call.verb === "insert") return { error: insertError };
      return {};
    },
  });
  return holder.mock;
}

function req(body: Record<string, unknown>): Request {
  return new Request("http://test/api/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const vacancyReport = (reason: string) => ({ targetType: "vacancy", targetId: VACANCY_ID, reason });
const companyReport = (reason: string) => ({ targetType: "company", targetId: COMPANY_ID, reason });

const insertOf = (mock: SupabaseMock) =>
  mock.calls.find((call) => call.table === "content_reports" && call.verb === "insert");

beforeEach(() => {
  vi.mocked(getCompanyRole).mockResolvedValue(null);
});

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("reporting a vacancy", () => {
  it("reads the vacancy from its own table", async () => {
    const mock = setMock();
    await POST(req(vacancyReport("other")));
    const target = mock.calls[0];
    expect(target).toMatchObject({ table: "vacancies", verb: "select" });
    expect(target.filters).toEqual([{ method: "eq", args: ["id", VACANCY_ID] }]);
  });

  it("404 when the vacancy is not visible", async () => {
    setMock({ vacancy: null });
    expect((await POST(req(vacancyReport("spam_or_scam")))).status).toBe(404);
  });

  it("400 when a member of the company's team reports it", async () => {
    const mock = setMock();
    vi.mocked(getCompanyRole).mockResolvedValueOnce("recruiter");
    const res = await POST(req(vacancyReport("spam_or_scam")));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/your own content/i);
    expect(getCompanyRole).toHaveBeenCalledWith(mock.client, COMPANY_ID, USER_ID);
    expect(insertOf(mock)).toBeUndefined();
    expect(holdVacancyForReview).not.toHaveBeenCalled();
  });

  it("400 for its author even after leaving the team", async () => {
    setMock({
      vacancy: { id: VACANCY_ID, author_user_id: USER_ID, company_id: COMPANY_ID, moderation_status: "approved" },
    });
    expect((await POST(req(vacancyReport("other")))).status).toBe(400);
  });

  it("files the report against the vacancy column only", async () => {
    const mock = setMock();
    const res = await POST(req({ ...vacancyReport("spam_or_scam"), details: "  asks for money  " }));
    expect(res.status).toBe(200);

    const insert = insertOf(mock)!;
    expect(insert.payload).toEqual({
      target_type: "vacancy",
      target_vacancy_id: VACANCY_ID,
      target_owner_user_id: AUTHOR_ID,
      reporter_user_id: USER_ID,
      reason: "spam_or_scam",
      details: "asks for money",
      priority: "high",
    });

    const duplicate = mock.calls.find((call) => call.table === "content_reports" && call.verb === "select");
    expect(duplicate?.filters).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["reporter_user_id", USER_ID] },
        { method: "eq", args: ["target_vacancy_id", VACANCY_ID] },
        { method: "eq", args: ["reason", "spam_or_scam"] },
      ]),
    );
  });

  it("holds the vacancy on a scam report, with the service key", async () => {
    const mock = setMock();
    await POST(req(vacancyReport("spam_or_scam")));
    expect(holdVacancyForReview).toHaveBeenCalledWith(VACANCY_ID, AUTO_REVIEW_NOTE);
    expect(holdCompanyForReview).not.toHaveBeenCalled();
    // Neither the reporter nor the team writes moderation columns directly.
    expect(mock.calls.some((call) => call.verb === "update")).toBe(false);
  });

  it("holds the vacancy on an urgent report too", async () => {
    setMock();
    await POST(req(vacancyReport("harmful_or_dangerous")));
    expect(holdVacancyForReview).toHaveBeenCalledWith(VACANCY_ID, AUTO_REVIEW_NOTE);
  });

  it("leaves it alone for an ordinary reason or when it is already in review", async () => {
    setMock();
    await POST(req(vacancyReport("other")));
    await POST(req(vacancyReport("impersonation")));
    setMock({
      vacancy: { id: VACANCY_ID, author_user_id: AUTHOR_ID, company_id: COMPANY_ID, moderation_status: "under_review" },
    });
    await POST(req(vacancyReport("spam_or_scam")));
    expect(holdVacancyForReview).not.toHaveBeenCalled();
  });

  it("409 on a duplicate active report", async () => {
    const mock = setMock({ duplicate: { id: "dup" } });
    expect((await POST(req(vacancyReport("spam_or_scam")))).status).toBe(409);
    expect(insertOf(mock)).toBeUndefined();
    expect(holdVacancyForReview).not.toHaveBeenCalled();
  });

  it("400 and no hold when the report could not be saved", async () => {
    setMock({ insertError: { message: "insert failed" } });
    const res = await POST(req(vacancyReport("spam_or_scam")));
    expect(res.status).toBe(400);
    expect(holdVacancyForReview).not.toHaveBeenCalled();
  });
});

describe("reporting a company page", () => {
  it("400 for its creator or anyone on its team", async () => {
    setMock({ company: { id: COMPANY_ID, created_by: USER_ID, moderation_status: "approved" } });
    expect((await POST(req(companyReport("other")))).status).toBe(400);
    expect(getCompanyRole).not.toHaveBeenCalled();

    setMock();
    vi.mocked(getCompanyRole).mockResolvedValueOnce("owner");
    expect((await POST(req(companyReport("other")))).status).toBe(400);
  });

  it("files the report against the company column with its creator as the owner", async () => {
    const mock = setMock();
    expect((await POST(req(companyReport("impersonation")))).status).toBe(200);
    expect(insertOf(mock)?.payload).toEqual({
      target_type: "company",
      target_company_id: COMPANY_ID,
      target_owner_user_id: AUTHOR_ID,
      reporter_user_id: USER_ID,
      reason: "impersonation",
      details: null,
      priority: "high",
    });
    expect(holdCompanyForReview).not.toHaveBeenCalled();
  });

  it("holds the page on an urgent reason only", async () => {
    setMock();
    await POST(req(companyReport("spam_or_scam")));
    expect(holdCompanyForReview).not.toHaveBeenCalled();

    const mock = setMock();
    await POST(req(companyReport("harassment_or_hate")));
    expect(holdCompanyForReview).toHaveBeenCalledWith(COMPANY_ID, AUTO_REVIEW_NOTE);
    expect(holdVacancyForReview).not.toHaveBeenCalled();
    expect(mock.calls.some((call) => call.verb === "update")).toBe(false);
  });

  it("does not hold a page a moderator already holds", async () => {
    setMock({ company: { id: COMPANY_ID, created_by: AUTHOR_ID, moderation_status: "under_review" } });
    await POST(req(companyReport("sexual_content")));
    expect(holdCompanyForReview).not.toHaveBeenCalled();
  });
});
