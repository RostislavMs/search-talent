import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: { mock: null as SupabaseMock | null, isAdmin: false },
}));

vi.mock("@/lib/moderation-server", () => ({
  getCurrentViewerRole: vi.fn(async () => {
    const client = holder.mock!.client;
    const {
      data: { user },
    } = await client.auth.getUser();
    return { supabase: client, user, isAdmin: holder.isAdmin };
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => null) }));
vi.mock("@/lib/db/notifications", () => ({ createNotifications: vi.fn(async () => undefined) }));
vi.mock("@/lib/db/companies", () => ({ getCompanyRole: vi.fn(async () => null) }));
vi.mock("@/lib/db/vacancies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/vacancies")>();
  return { ...actual, holdVacancyForReview: vi.fn(async () => true) };
});

import { POST } from "@/app/api/vacancies/[id]/status/route";
import { getCompanyRole } from "@/lib/db/companies";
import { holdVacancyForReview } from "@/lib/db/vacancies";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const COMPANY_ID = "22222222-2222-4222-8222-222222222222";
const VACANCY_ID = "33333333-3333-4333-8333-333333333333";
const user: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };
const DAY = 24 * 60 * 60 * 1000;

const longText = "We are looking for a junior frontend developer to build interfaces with React and TypeScript.";

type Stored = {
  status: string;
  expires_at: string | null;
  moderation_status: string;
  title: string;
  description: string | null;
  city: string | null;
  kind: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_currency: string | null;
  pay_period: string | null;
};

function stored(patch: Partial<Stored> = {}) {
  return {
    id: VACANCY_ID,
    company_id: COMPANY_ID,
    status: "draft",
    expires_at: null,
    moderation_status: "approved",
    title: "Junior frontend developer",
    description: `<p>${longText}</p>`,
    city: "Kyiv",
    kind: "job",
    pay_min: 20_000,
    pay_max: 30_000,
    pay_currency: "uah",
    pay_period: "month",
    ...patch,
  };
}

function setMock(
  row: ReturnType<typeof stored> | null,
  {
    savedModeration = "approved",
    updateResult,
  }: { savedModeration?: string; updateResult?: QueryResult } = {},
) {
  holder.mock = createSupabaseMock({
    user,
    resolve: (call: QueryCall) => {
      if (call.table !== "vacancies") return {};
      if (call.verb === "select") return { data: row };
      if (call.verb === "update") {
        if (updateResult) return updateResult;
        const patch = call.payload as { status: string; expires_at?: string };
        return {
          data: {
            id: VACANCY_ID,
            status: patch.status,
            expires_at: patch.expires_at ? "2026-11-30T12:00:00Z" : row?.expires_at ?? null,
            moderation_status: savedModeration,
          },
        };
      }
      return {};
    },
  });
  return holder.mock;
}

function req(body: unknown) {
  return new Request(`http://test/api/vacancies/${VACANCY_ID}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = (id = VACANCY_ID) => ({ params: Promise.resolve({ id }) });

const updateOf = (mock: SupabaseMock) =>
  mock.calls.find((call) => call.table === "vacancies" && call.verb === "update");

const future = (days: number) => new Date(Date.now() + days * DAY).toISOString();

beforeEach(() => {
  holder.isAdmin = false;
  vi.mocked(getCompanyRole).mockResolvedValue("recruiter");
  vi.mocked(holdVacancyForReview).mockResolvedValue(true);
});

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/vacancies/:id/status — guards", () => {
  it("400 for a bad id", async () => {
    setMock(stored());
    expect((await POST(req({ action: "publish" }), params("nope"))).status).toBe(400);
  });

  it("401 for guests", async () => {
    holder.mock = createSupabaseMock({ user: null, resolve: () => ({}) });
    expect((await POST(req({ action: "publish" }), params())).status).toBe(401);
  });

  it("400 for an unknown action", async () => {
    setMock(stored());
    const res = await POST(req({ action: "delete" }), params());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid");
  });

  it("404 when the vacancy is not there", async () => {
    setMock(null);
    expect((await POST(req({ action: "publish" }), params())).status).toBe(404);
  });

  it("403 for someone outside the team", async () => {
    const mock = setMock(stored());
    vi.mocked(getCompanyRole).mockResolvedValueOnce(null);
    const res = await POST(req({ action: "publish" }), params());
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("forbidden");
    expect(getCompanyRole).toHaveBeenCalledWith(mock.client, COMPANY_ID, USER_ID);
    expect(updateOf(mock)).toBeUndefined();
  });

  it("lets a platform admin act on any vacancy", async () => {
    holder.isAdmin = true;
    setMock(stored({ status: "published", expires_at: future(30) }));
    vi.mocked(getCompanyRole).mockResolvedValueOnce(null);
    expect((await POST(req({ action: "close" }), params())).status).toBe(200);
  });
});

describe("publish", () => {
  it("sends a complete draft out and screens it", async () => {
    const mock = setMock(stored());
    const res = await POST(req({ action: "publish" }), params());
    expect(res.status).toBe(200);
    expect(updateOf(mock)?.payload).toEqual({ status: "published" });
    expect(updateOf(mock)?.filters).toEqual([{ method: "eq", args: ["id", VACANCY_ID] }]);
    expect(await res.json()).toEqual({
      vacancy: { id: VACANCY_ID, status: "published", expiresAt: null, moderationStatus: "approved" },
      heldForReview: false,
    });
    expect(holdVacancyForReview).not.toHaveBeenCalled();
  });

  it.each(["published", "closed", "expired"])("409 for a %s vacancy", async (status) => {
    const mock = setMock(stored({ status, expires_at: future(30) }));
    const res = await POST(req({ action: "publish" }), params());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("invalid_status");
    expect(updateOf(mock)).toBeUndefined();
  });

  it("says what a draft still needs", async () => {
    const short = setMock(stored({ description: "<p>Short</p>" }));
    const res = await POST(req({ action: "publish" }), params());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "description_short", issues: ["description_short"] });
    expect(updateOf(short)).toBeUndefined();

    setMock(stored({ pay_min: null, pay_max: null, pay_currency: null, pay_period: null }));
    const unpaid = await POST(req({ action: "publish" }), params());
    expect(await unpaid.json()).toMatchObject({ code: "pay_required", issues: ["pay_required"] });

    setMock(stored({ description: null, kind: "internship", pay_min: null }));
    const both = await POST(req({ action: "publish" }), params());
    expect(await both.json()).toMatchObject({ issues: ["description_short", "pay_required"] });
  });

  it("treats broken stored pay as no pay", async () => {
    setMock(stored({ pay_max: 10 }));
    expect(await (await POST(req({ action: "publish" }), params())).json()).toMatchObject({ code: "pay_required" });
  });

  it("publishes freelance without pay", async () => {
    setMock(stored({ kind: "freelance", pay_min: null, pay_max: null, pay_currency: null, pay_period: null }));
    expect((await POST(req({ action: "publish" }), params())).status).toBe(200);
  });

  it("holds a draft whose text reads like a scam at the moment it goes out", async () => {
    setMock(stored({ description: `<p>${longText} Потрібно внести депозит за обладнання.</p>` }));
    const res = await POST(req({ action: "publish" }), params());
    expect(await res.json()).toMatchObject({
      vacancy: { status: "published", moderationStatus: "under_review" },
      heldForReview: true,
    });
    expect(holdVacancyForReview).toHaveBeenCalledWith(VACANCY_ID, expect.stringContaining("[авто]"));
  });

  it("screens a vacancy the database sent to a moderator too, so the note says why", async () => {
    setMock(stored({ description: `<p>${longText} Pay a registration fee.</p>` }), { savedModeration: "under_review" });
    const res = await POST(req({ action: "publish" }), params());
    expect(await res.json()).toMatchObject({
      vacancy: { moderationStatus: "under_review" },
      heldForReview: true,
    });
    expect(holdVacancyForReview).toHaveBeenCalledWith(VACANCY_ID, expect.stringContaining("[авто]"));
  });

  it("leaves a stricter decision alone", async () => {
    setMock(stored({ description: `<p>${longText} Pay a registration fee.</p>` }), { savedModeration: "removed" });
    const res = await POST(req({ action: "publish" }), params());
    expect((await res.json()).heldForReview).toBe(false);
    expect(holdVacancyForReview).not.toHaveBeenCalled();
  });
});

describe("close", () => {
  it("takes an open vacancy down", async () => {
    const mock = setMock(stored({ status: "published", expires_at: future(30) }));
    const res = await POST(req({ action: "close" }), params());
    expect(res.status).toBe(200);
    expect(updateOf(mock)?.payload).toEqual({ status: "closed" });
    expect((await res.json()).vacancy.status).toBe("closed");
  });

  it("closes a published vacancy that has run out but the cron has not marked yet", async () => {
    const mock = setMock(stored({ status: "published", expires_at: future(-1) }));
    expect((await POST(req({ action: "close" }), params())).status).toBe(200);
    expect(updateOf(mock)?.payload).toEqual({ status: "closed" });
  });

  it.each(["draft", "closed", "expired"])("409 for a %s vacancy", async (status) => {
    const mock = setMock(stored({ status }));
    const res = await POST(req({ action: "close" }), params());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("invalid_status");
    expect(updateOf(mock)).toBeUndefined();
  });

  it("never screens on close", async () => {
    setMock(stored({ status: "published", expires_at: future(30), description: `<p>${longText} Внесіть депозит.</p>` }));
    await POST(req({ action: "close" }), params());
    expect(holdVacancyForReview).not.toHaveBeenCalled();
  });
});

describe("extend", () => {
  it.each([
    ["published", future(3)],
    ["published", future(-2)],
    ["expired", future(-2)],
    ["closed", future(10)],
  ])("opens a %s vacancy for 60 more days (expires %s)", async (status, expiresAt) => {
    const mock = setMock(stored({ status, expires_at: expiresAt }));
    const before = Date.now();
    const res = await POST(req({ action: "extend" }), params());
    expect(res.status).toBe(200);

    const patch = updateOf(mock)?.payload as { status: string; expires_at: string };
    expect(patch.status).toBe("published");
    expect(Object.keys(patch).sort()).toEqual(["expires_at", "status"]);
    expect(new Date(patch.expires_at).toISOString()).toBe(patch.expires_at);
    expect(Date.parse(patch.expires_at)).toBeGreaterThanOrEqual(before);

    expect(await res.json()).toEqual({
      vacancy: { id: VACANCY_ID, status: "published", expiresAt: "2026-11-30T12:00:00Z", moderationStatus: "approved" },
      heldForReview: false,
    });
    expect(holdVacancyForReview).not.toHaveBeenCalled();
  });

  it("409 for a draft: it has to be published first", async () => {
    const mock = setMock(stored({ status: "draft" }));
    const res = await POST(req({ action: "extend" }), params());
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("invalid_status");
    expect(updateOf(mock)).toBeUndefined();
  });
});

describe("write errors", () => {
  it.each([
    [{ code: "P0001", message: "invalid_vacancy_status" }, 409, "invalid_status"],
    [{ code: "42501", message: "row-level security" }, 403, "forbidden"],
    [{ code: "P0001", message: "vacancy_daily_limit_reached" }, 409, "daily_limit"],
    [{ code: "XX000", message: "boom" }, 400, "invalid"],
  ])("maps %o to %i %s", async (error, status, code) => {
    setMock(stored({ status: "published", expires_at: future(30) }), { updateResult: { error } });
    const res = await POST(req({ action: "close" }), params());
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: error.message, code });
  });

  it("404 when the update matched nothing", async () => {
    setMock(stored({ status: "published", expires_at: future(30) }), { updateResult: { data: null } });
    expect((await POST(req({ action: "close" }), params())).status).toBe(404);
  });
});
