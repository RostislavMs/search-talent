import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall, type QueryResult, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { admin: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => holder.admin?.client ?? null) }));

import {
  getMyContactOpenCompanies,
  getMyContactOpens,
  listContactCompanies,
  notifyCompanyContactOpened,
} from "@/lib/db/open-to";

const USER = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";

function client(resolve: (call: QueryCall) => QueryResult, rpc?: (fn: string) => QueryResult) {
  return createSupabaseMock({ resolve, rpc }).client as never;
}

afterEach(() => {
  holder.admin = null;
  vi.clearAllMocks();
});

describe("getMyContactOpens", () => {
  it("reads the count, 0 when unknown", async () => {
    expect(await getMyContactOpens(client(() => ({}), () => ({ data: [{ total: "4" }] })))).toBe(4);
    expect(await getMyContactOpens(client(() => ({}), () => ({ data: { total: 2 } })))).toBe(2);
    expect(await getMyContactOpens(client(() => ({}), () => ({ error: { message: "missing" } })))).toBe(0);
    expect(await getMyContactOpens(client(() => ({}), () => ({ data: [{ total: "x" }] })))).toBe(0);
  });
});

describe("getMyContactOpenCompanies", () => {
  it("maps the rows, empty on error or before the migration", async () => {
    const rows = [
      {
        company_id: "c1",
        slug: "acme",
        name: "Acme",
        logo_url: null,
        first_opened_at: "2026-10-01T10:00:00Z",
        last_opened_at: "2026-10-02T10:00:00Z",
      },
    ];
    expect(await getMyContactOpenCompanies(client(() => ({}), () => ({ data: rows })))).toEqual([
      {
        id: "c1",
        slug: "acme",
        name: "Acme",
        logoUrl: null,
        firstOpenedAt: "2026-10-01T10:00:00Z",
        lastOpenedAt: "2026-10-02T10:00:00Z",
      },
    ]);
    expect(await getMyContactOpenCompanies(client(() => ({}), () => ({ error: { message: "x" } })))).toEqual([]);
    expect(await getMyContactOpenCompanies(client(() => ({}), () => ({ data: null })))).toEqual([]);
  });
});

describe("listContactCompanies", () => {
  it("offers verified, visible companies only, by name", async () => {
    const companies = await listContactCompanies(
      client(() => ({
        data: [
          { company: { id: "z", name: "Zeta", verified_at: "2026-09-01", moderation_status: "approved" } },
          { company: [{ id: "a", name: "Acme", verified_at: "2026-09-01", moderation_status: "approved" }] },
          { company: { id: "u", name: "Unverified", verified_at: null, moderation_status: "approved" } },
          { company: { id: "h", name: "Hidden", verified_at: "2026-09-01", moderation_status: "removed" } },
          { company: null },
        ],
      })),
      USER,
    );

    expect(companies).toEqual([
      { id: "a", name: "Acme" },
      { id: "z", name: "Zeta" },
    ]);
  });

  it("is empty when the query fails", async () => {
    expect(await listContactCompanies(client(() => ({ error: { message: "x" } })), USER)).toEqual([]);
  });
});

describe("notifyCompanyContactOpened", () => {
  it("tells the person which company, not who in its team", async () => {
    holder.admin = createSupabaseMock({
      resolve: (call) => (call.table === "companies" ? { data: { slug: "acme", name: "Acme" } } : {}),
    });

    await notifyCompanyContactOpened({ ownerUserId: OWNER, companyId: "c1", actorUserId: USER });

    const insert = holder.admin.calls.find((call) => call.table === "notifications");
    expect(insert?.payload).toEqual([
      {
        recipient_user_id: OWNER,
        actor_user_id: null,
        type: "company_contact_opened",
        target_type: "company",
        target_id: "c1",
        metadata: { companyId: "c1", companySlug: "acme", companyName: "Acme" },
      },
    ]);
  });

  it("does nothing without the key, for oneself, or for a company that is gone", async () => {
    await notifyCompanyContactOpened({ ownerUserId: OWNER, companyId: "c1", actorUserId: USER });

    holder.admin = createSupabaseMock({ resolve: () => ({ data: null }) });
    await notifyCompanyContactOpened({ ownerUserId: USER, companyId: "c1", actorUserId: USER });
    expect(holder.admin.calls).toHaveLength(0);

    await notifyCompanyContactOpened({ ownerUserId: OWNER, companyId: "gone", actorUserId: USER });
    expect(holder.admin.calls.map((call) => call.table)).toEqual(["companies"]);
  });

  it("never throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    holder.admin = createSupabaseMock({
      resolve: () => {
        throw new Error("boom");
      },
    });

    await expect(
      notifyCompanyContactOpened({ ownerUserId: OWNER, companyId: "c1", actorUserId: USER }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
