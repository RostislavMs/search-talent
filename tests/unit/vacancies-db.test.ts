import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall, type QueryResult, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { admin: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => holder.admin?.client ?? null),
}));
vi.mock("@/lib/db/notifications", () => ({
  createNotifications: vi.fn(async () => undefined),
}));

import {
  countVacancyViews,
  expireVacancies,
  getJobsFilterOptions,
  getVacancyBySlug,
  listCompanyOpenVacancies,
  listOpenVacancies,
  listTeamVacancies,
  listVacanciesForAdmin,
  mapVacancyDetails,
  mapVacancySummary,
  saveVacancy,
  vacancyPayloadToRow,
  type VacancyDetailRow,
  type VacancySummaryRow,
} from "@/lib/db/vacancies";
import { createNotifications } from "@/lib/db/notifications";
import { EMPTY_VACANCY_FILTERS } from "@/lib/vacancies";
import type { VacancyPayload } from "@/lib/validation/vacancies";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const NOW_ISO = new Date(NOW).toISOString();
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const VACANCY_ID = "33333333-3333-4333-8333-333333333333";

function client(resolve: (call: QueryCall) => QueryResult) {
  return createSupabaseMock({ user: null, resolve });
}

function summaryRow(patch: Partial<VacancySummaryRow> = {}): VacancySummaryRow {
  return {
    id: VACANCY_ID,
    slug: "junior-designer-abc123",
    title: "Junior designer",
    kind: "internship",
    hours: "part_time",
    work_formats: ["office", "remote"],
    city: "Kyiv",
    experience_level: "junior",
    pay_min: 15,
    pay_max: 25,
    pay_currency: "usd",
    pay_period: "hour",
    locale: "en",
    status: "published",
    published_at: "2026-09-30T12:00:00Z",
    expires_at: "2026-11-29T12:00:00Z",
    moderation_status: "approved",
    company_id: COMPANY_ID,
    company: {
      id: COMPANY_ID,
      slug: "acme",
      name: "Acme",
      logo_url: "https://cdn.example/companies/x/logo",
      verified_at: "2026-09-01T00:00:00Z",
      moderation_status: "approved",
    },
    country: [{ name: "Ukraine" }],
    category: { name: "Design" },
    ...patch,
  };
}

function selected(call: QueryCall): string {
  return String(call.modifiers.find((modifier) => modifier.method === "select")?.args[0] ?? "");
}

afterEach(() => {
  holder.admin = null;
  vi.clearAllMocks();
});

describe("mapVacancySummary", () => {
  it("maps the row, its joins and its state", () => {
    expect(mapVacancySummary(summaryRow(), NOW)).toEqual({
      id: VACANCY_ID,
      slug: "junior-designer-abc123",
      title: "Junior designer",
      kind: "internship",
      hours: "part_time",
      workFormats: ["remote", "office"],
      city: "Kyiv",
      countryName: "Ukraine",
      experienceLevel: "junior",
      categoryName: "Design",
      pay: { min: 15, max: 25, currency: "usd", period: "hour" },
      locale: "en",
      status: "published",
      state: "open",
      moderationStatus: "approved",
      publishedAt: "2026-09-30T12:00:00Z",
      expiresAt: "2026-11-29T12:00:00Z",
      company: {
        id: COMPANY_ID,
        slug: "acme",
        name: "Acme",
        logoUrl: "https://cdn.example/companies/x/logo",
        verified: true,
        moderationStatus: "approved",
      },
    });
  });

  it("treats a published vacancy past its date as expired", () => {
    expect(mapVacancySummary(summaryRow({ expires_at: "2026-09-01T00:00:00Z" }), NOW).state).toBe("expired");
  });

  it("normalizes unknown values and missing joins", () => {
    const mapped = mapVacancySummary(
      summaryRow({
        kind: "mentoring",
        hours: "weekends",
        work_formats: null,
        experience_level: "guru",
        pay_min: null,
        locale: "de",
        status: "deleted",
        company: null,
        country: null,
        category: [],
      }),
      NOW,
    );
    expect(mapped).toMatchObject({
      kind: "job",
      hours: null,
      workFormats: [],
      experienceLevel: null,
      pay: null,
      locale: "uk",
      status: "draft",
      state: "draft",
      countryName: null,
      categoryName: null,
      company: { id: COMPANY_ID, slug: "", name: "", logoUrl: null, verified: false, moderationStatus: "approved" },
    });
  });
});

describe("mapVacancyDetails", () => {
  it("adds the long fields and the skills", () => {
    const row: VacancyDetailRow = {
      ...summaryRow(),
      description: null,
      country_id: 3,
      category_id: 7,
      author_user_id: "u1",
      closed_at: null,
      created_at: "2026-09-29T00:00:00Z",
      updated_at: "2026-09-30T00:00:00Z",
    };
    const skills = [{ id: 1, name: "Figma" }];
    expect(mapVacancyDetails(row, skills, NOW)).toMatchObject({
      id: VACANCY_ID,
      state: "open",
      description: "",
      countryId: 3,
      categoryId: 7,
      skills,
      authorUserId: "u1",
      closedAt: null,
      createdAt: "2026-09-29T00:00:00Z",
      updatedAt: "2026-09-30T00:00:00Z",
    });
  });
});

describe("vacancyPayloadToRow", () => {
  const payload: VacancyPayload = {
    title: "Junior designer",
    description: "<p>raw</p>",
    kind: "job",
    hours: "full_time",
    work_formats: ["remote"],
    country_id: 3,
    city: "Kyiv",
    experience_level: "junior",
    category_id: 7,
    pay: { min: 100, max: 200, currency: "usd", period: "month" },
    locale: "en",
    skill_ids: [1, 2],
    status: "published",
  };

  it("writes the form's columns with the sanitized description", () => {
    expect(vacancyPayloadToRow(payload, "<p>clean</p>")).toEqual({
      title: "Junior designer",
      description: "<p>clean</p>",
      kind: "job",
      hours: "full_time",
      work_formats: ["remote"],
      country_id: 3,
      city: "Kyiv",
      experience_level: "junior",
      category_id: 7,
      pay_min: 100,
      pay_max: 200,
      pay_currency: "usd",
      pay_period: "month",
      locale: "en",
    });
  });

  it("clears every pay column without pay, and never writes the status or skills", () => {
    const row = vacancyPayloadToRow({ ...payload, pay: null }, "");
    expect(row).toMatchObject({ pay_min: null, pay_max: null, pay_currency: null, pay_period: null });
    expect(row).not.toHaveProperty("status");
    expect(row).not.toHaveProperty("skill_ids");
    expect(row).not.toHaveProperty("slug");
  });
});

describe("listOpenVacancies", () => {
  it("lists open vacancies of visible companies, newest first", async () => {
    const mock = client(() => ({ data: [summaryRow()], count: 41 }));
    const result = await listOpenVacancies(mock.client as never, EMPTY_VACANCY_FILTERS, { now: NOW });

    expect(result.total).toBe(41);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: VACANCY_ID, state: "open" });

    const call = mock.calls[0];
    expect(call.table).toBe("vacancies");
    expect(call.filters).toEqual([
      { method: "eq", args: ["status", "published"] },
      { method: "eq", args: ["moderation_status", "approved"] },
      { method: "gt", args: ["expires_at", NOW_ISO] },
      { method: "eq", args: ["company.moderation_status", "approved"] },
    ]);
    const select = call.modifiers.find((modifier) => modifier.method === "select");
    expect(String(select?.args[0])).toContain("company:company_id!inner");
    expect(String(select?.args[0])).not.toContain("vacancy_skills");
    expect(select?.args[1]).toEqual({ count: "exact" });
    expect(call.modifiers).toEqual(
      expect.arrayContaining([
        { method: "order", args: ["published_at", { ascending: false }] },
        { method: "order", args: ["id", { ascending: true }] },
        { method: "range", args: [0, 19] },
      ]),
    );
  });

  it("applies every filter and the page", async () => {
    const mock = client(() => ({ data: [], count: 0 }));
    await listOpenVacancies(
      mock.client as never,
      {
        kind: "freelance",
        format: "remote",
        level: "middle",
        countryId: 3,
        categoryId: 7,
        skillId: 42,
        paid: true,
        q: "c++_dev 100%",
        page: 3,
      },
      { now: NOW, pageSize: 10 },
    );

    const call = mock.calls[0];
    expect(call.filters).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["kind", "freelance"] },
        { method: "contains", args: ["work_formats", ["remote"]] },
        { method: "eq", args: ["experience_level", "middle"] },
        { method: "eq", args: ["country_id", 3] },
        { method: "eq", args: ["category_id", 7] },
        { method: "eq", args: ["vacancy_skills.skill_id", 42] },
        { method: "not", args: ["pay_min", "is", null] },
        { method: "ilike", args: ["title", "%c++\\_dev 100\\%%"] },
      ]),
    );
    expect(selected(call)).toContain("vacancy_skills!inner ( skill_id )");
    expect(call.modifiers).toContainEqual({ method: "range", args: [20, 29] });
  });

  it("drops a '*' from the search: PostgREST would read it as a wildcard", async () => {
    const mock = client(() => ({ data: [] }));
    await listOpenVacancies(mock.client as never, { ...EMPTY_VACANCY_FILTERS, q: "*dev*" }, { now: NOW });
    expect(mock.calls[0].filters).toContainEqual({ method: "ilike", args: ["title", "%dev%"] });
  });

  it("returns nothing on a database error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const mock = client(() => ({ error: { message: "boom" } }));
    expect(await listOpenVacancies(mock.client as never, EMPTY_VACANCY_FILTERS, { now: NOW })).toEqual({
      items: [],
      total: 0,
    });
    spy.mockRestore();
  });

  it("falls back to the page length without a count", async () => {
    const mock = client(() => ({ data: [summaryRow(), summaryRow({ id: "v2" })] }));
    expect((await listOpenVacancies(mock.client as never, EMPTY_VACANCY_FILTERS, { now: NOW })).total).toBe(2);
  });
});

describe("other lists", () => {
  it("lists one company's open vacancies", async () => {
    const mock = client(() => ({ data: [summaryRow()] }));
    const items = await listCompanyOpenVacancies(mock.client as never, COMPANY_ID, { now: NOW, limit: 5 });
    expect(items).toHaveLength(1);
    expect(mock.calls[0].filters).toEqual([
      { method: "eq", args: ["company_id", COMPANY_ID] },
      { method: "eq", args: ["status", "published"] },
      { method: "eq", args: ["moderation_status", "approved"] },
      { method: "gt", args: ["expires_at", NOW_ISO] },
    ]);
    expect(mock.calls[0].modifiers).toContainEqual({ method: "limit", args: [5] });
  });

  it("offers only the places, fields and skills open vacancies have", async () => {
    const mock = client(() => ({
      data: [
        {
          country_id: 2,
          category_id: 7,
          country: { name: "Ukraine" },
          category: [{ name: "Design" }],
          vacancy_skills: [{ skill: { id: 5, name: "Figma" } }, { skill: [{ id: 1, name: "CSS" }] }],
        },
        {
          country_id: 1,
          category_id: null,
          country: { name: "Poland" },
          category: null,
          vacancy_skills: [{ skill: { id: 5, name: "Figma" } }, { skill: null }],
        },
        { country_id: 2, category_id: 7, country: { name: "Ukraine" }, category: { name: "Design" }, vacancy_skills: null },
      ],
    }));
    expect(await getJobsFilterOptions(mock.client as never, NOW)).toEqual({
      countries: [
        { id: 1, name: "Poland" },
        { id: 2, name: "Ukraine" },
      ],
      categories: [{ id: 7, name: "Design" }],
      skills: [
        { id: 1, name: "CSS" },
        { id: 5, name: "Figma" },
      ],
    });
  });

  it("reads one vacancy by its address, with its skills sorted", async () => {
    const detail = {
      ...summaryRow(),
      description: "<p>Hi</p>",
      country_id: 3,
      category_id: null,
      author_user_id: "u1",
      closed_at: null,
      created_at: "2026-09-29T00:00:00Z",
      updated_at: "2026-09-30T00:00:00Z",
    };
    const mock = client((call) =>
      call.table === "vacancies"
        ? { data: detail }
        : { data: [{ skill_id: 2, skill: { id: 2, name: "Sketch" } }, { skill_id: 1, skill: [{ id: 1, name: "Figma" }] }] },
    );
    const vacancy = await getVacancyBySlug(mock.client as never, "junior-designer-abc123");
    expect(vacancy?.skills).toEqual([
      { id: 1, name: "Figma" },
      { id: 2, name: "Sketch" },
    ]);
    expect(mock.calls[0].filters).toEqual([{ method: "eq", args: ["slug", "junior-designer-abc123"] }]);
    expect(mock.calls[1].filters).toEqual([{ method: "eq", args: ["vacancy_id", VACANCY_ID] }]);

    const missing = client(() => ({ data: null }));
    expect(await getVacancyBySlug(missing.client as never, "gone")).toBeNull();
  });
});

describe("listTeamVacancies and views", () => {
  const teamRow = { ...summaryRow(), updated_at: "2026-09-30T00:00:00Z", author_user_id: "u1" };

  it("asks for nothing without companies", async () => {
    const mock = client(() => ({ data: [] }));
    expect(await listTeamVacancies(mock.client as never, [])).toEqual([]);
    expect(mock.calls).toHaveLength(0);
  });

  it("adds the view counts the database counted (vacancy_view_counts)", async () => {
    const rpcCalls: Array<[string, unknown]> = [];
    holder.admin = createSupabaseMock({
      user: null,
      resolve: () => ({}),
      rpc: (fn, args) => {
        rpcCalls.push([fn, args]);
        // bigint arrives as a string from PostgREST.
        return { data: [{ vacancy_id: VACANCY_ID, views: "2" }, { vacancy_id: "other", views: 7 }] };
      },
    });
    const mock = client(() => ({ data: [teamRow, { ...teamRow, id: "v2" }] }));
    const items = await listTeamVacancies(mock.client as never, [COMPANY_ID, "c2"], NOW);

    expect(items.map((item) => [item.id, item.views, item.authorUserId, item.updatedAt])).toEqual([
      [VACANCY_ID, 2, "u1", "2026-09-30T00:00:00Z"],
      ["v2", 0, "u1", "2026-09-30T00:00:00Z"],
    ]);
    expect(mock.calls[0].filters).toEqual([{ method: "in", args: ["company_id", [COMPANY_ID, "c2"]] }]);
    // Counted in the database: no rows are fetched, so no row limit applies.
    expect(holder.admin.calls).toHaveLength(0);
    expect(rpcCalls).toEqual([["vacancy_view_counts", { p_ids: [VACANCY_ID, "v2"] }]]);
  });

  it("shows no counts without the service key", async () => {
    const mock = client(() => ({ data: [teamRow] }));
    const [item] = await listTeamVacancies(mock.client as never, [COMPANY_ID], NOW);
    expect(item.views).toBeNull();
  });

  it("counts views only when it can", async () => {
    expect(await countVacancyViews([VACANCY_ID])).toBeNull();

    holder.admin = client(() => ({ data: [] }));
    expect(await countVacancyViews([])).toEqual(new Map());
    expect(holder.admin.calls).toHaveLength(0);

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    holder.admin = createSupabaseMock({
      user: null,
      resolve: () => ({}),
      rpc: () => ({ error: { message: "closed" } }),
    });
    expect(await countVacancyViews([VACANCY_ID])).toBeNull();
    spy.mockRestore();
  });
});

describe("saveVacancy", () => {
  const saved = { id: VACANCY_ID, slug: "designer-abc123", status: "draft", moderation_status: "approved" };

  it("saves the vacancy and its skills in one database call", async () => {
    const rpc = vi.fn(async () => ({ data: saved, error: null }));
    const result = await saveVacancy({ rpc } as never, null, { title: "Designer" }, [3, 5]);
    expect(rpc).toHaveBeenCalledWith("save_vacancy", { p_id: null, p_row: { title: "Designer" }, p_skill_ids: [3, 5] });
    expect(result).toEqual({ vacancy: saved, error: null });
  });

  it("passes the database error on, as is", async () => {
    const error = { message: "vacancy_skills_limit_reached", code: "P0001" };
    const rpc = vi.fn(async () => ({ data: null, error }));
    expect(await saveVacancy({ rpc } as never, VACANCY_ID, {}, [1])).toEqual({ vacancy: null, error });
  });
});

describe("expireVacancies", () => {
  function adminFor(resolve: (call: QueryCall) => QueryResult) {
    holder.admin = client(resolve);
    return holder.admin;
  }

  const expired = [
    { id: "v1", slug: "one-aaaaaa", title: "One", company_id: "c1", author_user_id: "u-author" },
    { id: "v2", slug: "two-bbbbbb", title: "Two", company_id: "c2", author_user_id: "u-gone" },
  ];

  it("does nothing without the service key", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await expireVacancies(NOW)).toBe(0);
    spy.mockRestore();
  });

  it("expires what ran out and tells the author or, once they left, the managers", async () => {
    const admin = adminFor((call) => {
      if (call.table === "vacancies") return { data: expired };
      if (call.table === "company_members") {
        const company = call.filters.find((filter) => filter.args[0] === "company_id")?.args[1];
        return company === "c1"
          ? { data: [{ user_id: "u-author", role: "recruiter" }, { user_id: "u-owner", role: "owner" }] }
          : { data: [{ user_id: "u-owner2", role: "owner" }, { user_id: "u-rec", role: "recruiter" }] };
      }
      if (call.table === "companies") return { data: { slug: "acme", name: "Acme" } };
      return {};
    });

    expect(await expireVacancies(NOW)).toBe(2);

    const update = admin.calls[0];
    expect(update).toMatchObject({ table: "vacancies", verb: "update", payload: { status: "expired" } });
    expect(update.filters).toEqual([
      { method: "eq", args: ["status", "published"] },
      { method: "lte", args: ["expires_at", NOW_ISO] },
    ]);
    expect(selected(update)).toBe("id, slug, title, company_id, author_user_id");

    expect(createNotifications).toHaveBeenCalledTimes(2);
    const [[, first], [, second]] = vi.mocked(createNotifications).mock.calls;
    expect(first).toEqual([
      expect.objectContaining({
        recipientUserId: "u-author",
        type: "vacancy_expired",
        targetType: "vacancy",
        targetId: "v1",
        metadata: expect.objectContaining({ vacancySlug: "one-aaaaaa", vacancyTitle: "One" }),
      }),
    ]);
    expect(second).toEqual([expect.objectContaining({ recipientUserId: "u-owner2", targetId: "v2" })]);
  });

  it("returns 0 when nothing ran out", async () => {
    adminFor(() => ({ data: [] }));
    expect(await expireVacancies(NOW)).toBe(0);
    expect(createNotifications).not.toHaveBeenCalled();
  });

  it("throws when the update fails", async () => {
    adminFor(() => ({ error: { message: "db down" } }));
    await expect(expireVacancies(NOW)).rejects.toThrow("db down");
  });

  it("does not let a lost notification undo the expiry", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    adminFor((call) => {
      if (call.table === "vacancies") return { data: expired };
      if (call.table === "company_members") return { data: [{ user_id: "u-author", role: "owner" }] };
      return { data: { slug: "acme", name: "Acme" } };
    });
    vi.mocked(createNotifications).mockRejectedValueOnce(new Error("notify failed"));
    expect(await expireVacancies(NOW)).toBe(2);
    expect(createNotifications).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

describe("listVacanciesForAdmin", () => {
  const adminRow = { ...summaryRow(), created_at: "2026-09-29T00:00:00Z", moderation_note: "[авто] scam" };

  it("shows what waits for review by default, without drafts", async () => {
    const mock = client(() => ({ data: [adminRow] }));
    const items = await listVacanciesForAdmin(mock.client as never);
    expect(items).toEqual([
      expect.objectContaining({ id: VACANCY_ID, createdAt: "2026-09-29T00:00:00Z", moderationNote: "[авто] scam" }),
    ]);
    expect(mock.calls[0].filters).toEqual([
      { method: "neq", args: ["status", "draft"] },
      { method: "eq", args: ["moderation_status", "under_review"] },
    ]);
    expect(mock.calls[0].modifiers).toEqual(
      expect.arrayContaining([
        { method: "order", args: ["created_at", { ascending: false }] },
        { method: "limit", args: [200] },
      ]),
    );
  });

  it("filters open and hidden vacancies, or none", async () => {
    const open = client(() => ({ data: [] }));
    await listVacanciesForAdmin(open.client as never, "open", 50);
    expect(open.calls[0].filters).toEqual([
      { method: "neq", args: ["status", "draft"] },
      { method: "eq", args: ["status", "published"] },
      { method: "eq", args: ["moderation_status", "approved"] },
      { method: "gt", args: ["expires_at", expect.any(String)] },
    ]);
    expect(open.calls[0].modifiers).toContainEqual({ method: "limit", args: [50] });

    const hidden = client(() => ({ data: [] }));
    await listVacanciesForAdmin(hidden.client as never, "hidden");
    expect(hidden.calls[0].filters).toEqual([
      { method: "neq", args: ["status", "draft"] },
      { method: "in", args: ["moderation_status", ["restricted", "removed"]] },
    ]);

    const all = client(() => ({ data: [] }));
    await listVacanciesForAdmin(all.client as never, "all");
    expect(all.calls[0].filters).toEqual([{ method: "neq", args: ["status", "draft"] }]);
  });

  it("returns nothing on an error", async () => {
    const mock = client(() => ({ error: { message: "no" } }));
    expect(await listVacanciesForAdmin(mock.client as never, "all")).toEqual([]);
  });
});
