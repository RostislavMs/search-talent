import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall } from "./helpers/supabase-mock";

vi.mock("@/lib/db/companies", () => ({
  notifyCompanyProjectRequest: vi.fn(async () => undefined),
}));

import { notifyCompanyProjectRequest } from "@/lib/db/companies";
import {
  getPublicProjectBudget,
  loadProjectBudget,
  loadProjectCompanyLinks,
  saveProjectBudget,
  syncProjectCompanies,
} from "@/lib/db/project-companies";

const PROJECT_ID = "p1";

function client(
  resolve: (call: QueryCall) => { data?: unknown; error?: unknown },
  rpc?: (fn: string, args?: unknown) => { data?: unknown; error?: unknown },
) {
  return createSupabaseMock({ user: null, resolve, rpc });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("loadProjectCompanyLinks", () => {
  it("returns shown and waiting links with the company, skipping hidden pages", async () => {
    const mock = client(() => ({
      data: [
        { company_id: "c1", status: "approved", confirmed_at: "2026-09-30", company: { id: "c1", slug: "acme", name: "Acme", logo_url: null, verified_at: "2026-09-01" } },
        { company_id: "c2", status: "pending", confirmed_at: null, company: [{ id: "c2", slug: "beta", name: "Beta", logo_url: null, verified_at: null }] },
        { company_id: "c3", status: "approved", confirmed_at: null, company: null },
      ],
    }));
    expect(await loadProjectCompanyLinks(mock.client as never, PROJECT_ID)).toEqual([
      { companyId: "c1", slug: "acme", name: "Acme", logoUrl: null, verified: true, status: "approved", confirmed: true },
      { companyId: "c2", slug: "beta", name: "Beta", logoUrl: null, verified: false, status: "pending", confirmed: false },
    ]);
  });

  it("is empty on an error (before the migration)", async () => {
    const mock = client(() => ({ error: { message: "relation does not exist" } }));
    expect(await loadProjectCompanyLinks(mock.client as never, PROJECT_ID)).toEqual([]);
  });
});

describe("syncProjectCompanies", () => {
  it("drops removed links, adds new ones and tells companies about requests", async () => {
    const mock = client((call) => {
      if (call.verb === "select") return { data: [{ company_id: "keep" }, { company_id: "gone" }] };
      if (call.verb === "insert") {
        const companyId = (call.payload as { company_id: string }).company_id;
        return { data: { status: companyId === "request" ? "pending" : "approved" } };
      }
      return {};
    });

    await syncProjectCompanies({
      supabase: mock.client as never,
      projectId: PROJECT_ID,
      userId: "u1",
      desiredCompanyIds: ["keep", "member", "request"],
      published: true,
    });

    const deleted = mock.calls.find((call) => call.verb === "delete");
    expect(deleted?.filters).toEqual([
      { method: "eq", args: ["project_id", PROJECT_ID] },
      { method: "in", args: ["company_id", ["gone"]] },
    ]);
    const inserted = mock.calls.filter((call) => call.verb === "insert").map((call) => call.payload);
    expect(inserted).toEqual([
      { company_id: "member", project_id: PROJECT_ID, added_by: "u1" },
      { company_id: "request", project_id: PROJECT_ID, added_by: "u1" },
    ]);
    expect(notifyCompanyProjectRequest).toHaveBeenCalledTimes(1);
    expect(notifyCompanyProjectRequest).toHaveBeenCalledWith({
      companyId: "request",
      projectId: PROJECT_ID,
      actorUserId: "u1",
    });
  });

  it("does not ask companies to look at a draft", async () => {
    const mock = client((call) => (call.verb === "insert" ? { data: { status: "pending" } } : { data: [] }));
    await syncProjectCompanies({
      supabase: mock.client as never,
      projectId: PROJECT_ID,
      userId: "u1",
      desiredCompanyIds: ["request"],
      published: false,
    });
    expect(notifyCompanyProjectRequest).not.toHaveBeenCalled();
  });

  it("keeps going when one company refuses", async () => {
    const mock = client((call) => {
      if (call.verb === "insert") {
        return (call.payload as { company_id: string }).company_id === "bad"
          ? { error: { message: "row-level security" } }
          : { data: { status: "approved" } };
      }
      return { data: [] };
    });
    await syncProjectCompanies({
      supabase: mock.client as never,
      projectId: PROJECT_ID,
      userId: "u1",
      desiredCompanyIds: ["bad", "good"],
      published: true,
    });
    expect(mock.calls.filter((call) => call.verb === "insert")).toHaveLength(2);
  });
});

describe("budgets", () => {
  it("saves a budget with the show switch", async () => {
    const mock = client(() => ({}));
    expect(
      await saveProjectBudget(mock.client as never, PROJECT_ID, {
        amount: 8000,
        currency: "uah",
        type: "fixed",
        isPublic: true,
      }),
    ).toBe(true);
    expect(mock.calls[0]).toMatchObject({
      table: "project_private_details",
      verb: "upsert",
      payload: {
        project_id: PROJECT_ID,
        budget_amount: 8000,
        budget_currency: "uah",
        budget_type: "fixed",
        budget_public: true,
      },
    });
  });

  it("removes the budget when the form sends none", async () => {
    const mock = client(() => ({}));
    await saveProjectBudget(mock.client as never, PROJECT_ID, null);
    expect(mock.calls[0]).toMatchObject({ table: "project_private_details", verb: "delete" });
  });

  it("reads the author's budget for the editor", async () => {
    const mock = client(() => ({
      data: { budget_amount: 20, budget_currency: "usd", budget_type: "hourly", budget_public: false },
    }));
    expect(await loadProjectBudget(mock.client as never, PROJECT_ID)).toEqual({
      amount: 20,
      currency: "usd",
      type: "hourly",
      isPublic: false,
    });
    const broken = client(() => ({ data: { budget_amount: 20, budget_currency: "btc", budget_type: "hourly", budget_public: true } }));
    expect(await loadProjectBudget(broken.client as never, PROJECT_ID)).toBeNull();
  });

  it("shows only what project_public_budget() returns", async () => {
    const shown = client(() => ({}), () => ({ data: [{ amount: 8000, currency: "uah", type: "fixed" }] }));
    expect(await getPublicProjectBudget(shown.client as never, PROJECT_ID)).toEqual({
      amount: 8000,
      currency: "uah",
      type: "fixed",
    });
    const hidden = client(() => ({}), () => ({ data: [] }));
    expect(await getPublicProjectBudget(hidden.client as never, PROJECT_ID)).toBeNull();
  });
});
