import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall } from "./helpers/supabase-mock";

import {
  getPublicProjectBudget,
  loadProjectBudget,
  loadProjectCompanyLinks,
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

describe("budgets", () => {
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
