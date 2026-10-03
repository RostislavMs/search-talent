import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type QueryCall,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({
  holder: { admin: null as SupabaseMock | null },
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => holder.admin?.client ?? null) }));
vi.mock("@/lib/email/resend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/resend")>()),
  sendEmailBatch: vi.fn(async (inputs: unknown[]) => inputs.map(() => ({ sent: true }))),
}));

import {
  createJobAlert,
  deleteJobAlert,
  listJobAlertMatches,
  listMyJobAlerts,
  nameJobAlert,
  runJobAlerts,
  setJobAlertEmail,
  turnOffJobAlertEmails,
} from "@/lib/db/job-alerts";
import { sendEmailBatch, type SendEmailInput } from "@/lib/email/resend";
import { withoutPage } from "@/lib/job-alerts";
import { EMPTY_VACANCY_FILTERS } from "@/lib/vacancies";

const NOW = Date.parse("2026-10-03T03:30:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const NONE = withoutPage(EMPTY_VACANCY_FILTERS);

const U1 = "00000001-0000-4000-8000-000000000000";
const U2 = "00000002-0000-4000-8000-000000000000";
const U3 = "00000003-0000-4000-8000-000000000000";
const U4 = "00000004-0000-4000-8000-000000000000";
const U5 = "00000005-0000-4000-8000-000000000000";
const U6 = "00000006-0000-4000-8000-000000000000";

const COMPANY = { id: "c1", slug: "acme", name: "Acme", logo_url: null, verified_at: ago(30), moderation_status: "approved" };
const OWN = { ...COMPANY, id: "own", slug: "own-co", name: "Own Co" };

function vacancyRow(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    slug: `${id}-slug`,
    title: `Vacancy ${id}`,
    kind: "internship",
    hours: null,
    work_formats: ["remote"],
    city: "Київ",
    experience_level: "junior",
    pay_min: 500,
    pay_max: 800,
    pay_currency: "usd",
    pay_period: "month",
    locale: "uk",
    status: "published",
    published_at: ago(1),
    expires_at: new Date(NOW + 50 * DAY).toISOString(),
    moderation_status: "approved",
    moderated_at: null,
    company_id: COMPANY.id,
    country_id: 1,
    category_id: 7,
    company: COMPANY,
    country: { name: "Україна" },
    category: { name: "Розробка" },
    vacancy_skills: [{ skill_id: 10 }],
    ...patch,
  };
}

const V1 = vacancyRow("v1");
const V2 = vacancyRow("v2", { kind: "job", work_formats: ["office"], company_id: OWN.id, company: OWN, pay_period: "hour" });
// Went out three weeks ago, a moderator let it through yesterday.
const V3 = vacancyRow("v3", { work_formats: ["office"], published_at: ago(20), moderated_at: ago(1), pay_min: null, pay_max: null, pay_currency: null, pay_period: null });
// Went out three weeks ago and nothing since: not news.
const V4 = vacancyRow("v4", { published_at: ago(20) });

function alert(id: string, userId: string, params: unknown, notifyEmail: boolean, createdDaysAgo = 30) {
  return { id, user_id: userId, name: `Alert ${id}`, params, notify_email: notifyEmail, created_at: ago(createdDaysAgo) };
}

const ALERTS = [
  alert("a1", U1, { kind: "internship" }, true),
  alert("a2", U1, { match: "profile" }, false),
  alert("a3", U2, {}, true, 0.01),
  alert("a4", U3, { kind: "job" }, true),
  alert("a5", U4, { kind: "internship", format: "remote" }, true),
  alert("a6", U5, { kind: "internship" }, true),
  alert("a7", U6, { match: "profile" }, true),
];

const USERS: Record<string, { email: string; email_confirmed_at: string | null; user_metadata?: Record<string, unknown> }> = {
  [U1]: { email: "u1@example.com", email_confirmed_at: ago(100), user_metadata: { locale: "en" } },
  [U4]: { email: "u4@example.com", email_confirmed_at: null },
  [U5]: { email: "u5@example.com", email_confirmed_at: ago(100) },
};

type State = {
  vacancies: unknown[];
  alerts: unknown[];
  upsertError?: { message: string };
  vacanciesError?: { message: string };
};

function makeAdmin(state: State) {
  const resolve = (call: QueryCall): QueryResult => {
    const select = String(call.modifiers.find((modifier) => modifier.method === "select")?.args[0] ?? "");
    switch (call.table) {
      case "job_alert_deliveries":
        if (call.verb === "upsert") return state.upsertError ? { error: state.upsertError } : {};
        if (call.verb === "select") return { data: [{ saved_search_id: "a1", vacancy_id: "v3" }] };
        return {};
      case "vacancies":
        return state.vacanciesError ? { error: state.vacanciesError } : { data: state.vacancies };
      case "saved_searches":
        return { data: state.alerts };
      case "company_members":
        return { data: [{ user_id: U3, company_id: OWN.id }] };
      case "profiles":
        if (select.includes("open_to")) {
          return { data: [{ id: "p1", user_id: U1, open_to: ["job", "mentoring"], work_formats: [] }] };
        }
        return { data: { name: "Олена", username: "olena" } };
      case "profile_skills":
        return { data: [] };
      default:
        return {};
    }
  };

  const mock = createSupabaseMock({ resolve });
  (mock.client.auth as Record<string, unknown>).admin = {
    getUserById: vi.fn(async (id: string) => ({ data: { user: USERS[id] ? { id, ...USERS[id] } : null }, error: null })),
  };
  return mock;
}

const callsTo = (table: string, verb?: string) =>
  holder.admin!.calls.filter((call) => call.table === table && (!verb || call.verb === verb));

beforeEach(() => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-secret");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://searchtalent.example");
});

afterEach(() => {
  holder.admin = null;
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("runJobAlerts", () => {
  it("does nothing without the service key", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await runJobAlerts(NOW)).toEqual({ vacancies: 0, alerts: 0, people: 0, emails: 0, failedEmails: 0 });
    spy.mockRestore();
  });

  it("only purges old deliveries when nothing went live", async () => {
    holder.admin = makeAdmin({ vacancies: [V4], alerts: ALERTS });
    expect(await runJobAlerts(NOW)).toEqual({ vacancies: 0, alerts: 0, people: 0, emails: 0, failedEmails: 0 });

    const [purge] = callsTo("job_alert_deliveries", "delete");
    expect(purge.filters).toEqual([{ method: "lt", args: ["delivered_at", ago(90)] }]);
    expect(callsTo("saved_searches")).toHaveLength(0);
    expect(sendEmailBatch).not.toHaveBeenCalled();
  });

  it("says how many went live when nobody follows anything", async () => {
    holder.admin = makeAdmin({ vacancies: [V1], alerts: [] });
    expect(await runJobAlerts(NOW)).toEqual({ vacancies: 1, alerts: 0, people: 0, emails: 0, failedEmails: 0 });
  });

  it("throws when the vacancies cannot be read", async () => {
    holder.admin = makeAdmin({ vacancies: [], alerts: [], vacanciesError: { message: "no column" } });
    await expect(runJobAlerts(NOW)).rejects.toThrow("no column");
  });

  it("matches, emails, records and notifies once per person", async () => {
    vi.mocked(sendEmailBatch).mockImplementationOnce(async (inputs) =>
      inputs.map((input) => (input.to === "u5@example.com" ? { sent: false, error: "status_500" } : { sent: true })),
    );
    holder.admin = makeAdmin({ vacancies: [V1, V2, V3, V4], alerts: ALERTS });

    const result = await runJobAlerts(NOW);

    expect(result).toEqual({ vacancies: 3, alerts: 7, people: 2, emails: 1, failedEmails: 1 });

    // The query asks only for what is open and recent.
    const [vacancies] = callsTo("vacancies");
    expect(vacancies.filters).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["status", "published"] },
        { method: "eq", args: ["moderation_status", "approved"] },
        { method: "eq", args: ["company.moderation_status", "approved"] },
        { method: "or", args: [`published_at.gt.${ago(8)},moderated_at.gt.${ago(8)}`] },
      ]),
    );

    // One batch: U1 (one emailed alert) and U5; U4 has no confirmed address.
    const inputs = vi.mocked(sendEmailBatch).mock.calls[0][0] as SendEmailInput[];
    expect(inputs.map((input) => input.to)).toEqual(["u1@example.com", "u5@example.com"]);
    const [first] = inputs;
    expect(first.subject).toBe("1 new vacancy for you");
    expect(first.text).toContain("Vacancy v1");
    expect(first.text).toContain("https://searchtalent.example/en/jobs/v1-slug");
    expect(first.text).toContain("Internship · 500–800 USD per month · Remote · Київ, Україна");
    expect(first.text).not.toContain("Vacancy v3"); // already sent by a1 before
    expect(first.text).not.toContain("Vacancy v2"); // a2 (fits me) has no email
    expect(first.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(first.headers?.["List-Unsubscribe"]).toMatch(
      /^<https:\/\/searchtalent\.example\/api\/job-alerts\/unsubscribe\?u=00000001-0000-4000-8000-000000000000&t=[0-9a-f]{64}>$/,
    );

    // Recorded: U1 and U4, not U5 (its email failed: tomorrow again).
    const upserts = callsTo("job_alert_deliveries", "upsert").map((call) => call.payload);
    expect(upserts).toEqual([
      [
        { saved_search_id: "a1", vacancy_id: "v1", emailed: true },
        { saved_search_id: "a2", vacancy_id: "v2", emailed: false },
      ],
      [{ saved_search_id: "a5", vacancy_id: "v1", emailed: false }],
    ]);
    expect(callsTo("job_alert_deliveries", "upsert")[0].modifiers).toEqual([]);

    const notifications = callsTo("notifications", "insert").map((call) => call.payload);
    expect(notifications).toEqual([
      [
        expect.objectContaining({
          recipient_user_id: U1,
          type: "vacancy_match",
          target_type: null,
          target_id: null,
          metadata: expect.objectContaining({ matchCount: 2, searchName: undefined }),
        }),
      ],
      [
        expect.objectContaining({
          recipient_user_id: U4,
          type: "vacancy_match",
          target_type: "vacancy",
          target_id: "v1",
          metadata: expect.objectContaining({
            matchCount: 1,
            searchName: "Alert a5",
            vacancySlug: "v1-slug",
            vacancyTitle: "Vacancy v1",
            companyName: "Acme",
          }),
        }),
      ],
    ]);
  });

  it("does not count an unsent email as a failure when email is not set up", async () => {
    vi.mocked(sendEmailBatch).mockImplementationOnce(async (inputs) =>
      inputs.map(() => ({ sent: false, error: "email_not_configured" })),
    );
    holder.admin = makeAdmin({ vacancies: [V1], alerts: [ALERTS[0]] });

    expect(await runJobAlerts(NOW)).toMatchObject({ people: 1, emails: 0, failedEmails: 0 });
    expect(callsTo("job_alert_deliveries", "upsert")[0].payload).toEqual([
      { saved_search_id: "a1", vacancy_id: "v1", emailed: false },
    ]);
  });

  it("skips the notification when the deliveries could not be recorded", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    holder.admin = makeAdmin({ vacancies: [V1], alerts: [ALERTS[0]], upsertError: { message: "down" } });

    expect(await runJobAlerts(NOW)).toMatchObject({ people: 0 });
    expect(callsTo("notifications")).toHaveLength(0);
    spy.mockRestore();
  });
});

describe("the person's own alerts", () => {
  const ROW = {
    id: "a1",
    user_id: U1,
    name: "Робота",
    params: { kind: "job" },
    notify_email: null,
    created_at: ago(1),
  };

  it("lists them with where each leads", async () => {
    const mock = createSupabaseMock({ resolve: () => ({ data: [ROW, { ...ROW, id: "a2", params: { match: "profile" }, notify_email: true }] }) });
    const alerts = await listMyJobAlerts(mock.client as never, U1);

    expect(alerts).toEqual([
      expect.objectContaining({ id: "a1", notifyEmail: false, href: "/jobs?kind=job", target: { type: "filters", filters: { ...NONE, kind: "job" } } }),
      expect.objectContaining({ id: "a2", notifyEmail: true, href: "/my-space/job-alerts", target: { type: "profile" } }),
    ]);
    expect(mock.calls[0].filters).toEqual([
      { method: "eq", args: ["user_id", U1] },
      { method: "eq", args: ["mode", "vacancies"] },
    ]);
  });

  it("is empty before the migration", async () => {
    const mock = createSupabaseMock({ resolve: () => ({ error: { message: "column notify_email does not exist" } }) });
    expect(await listMyJobAlerts(mock.client as never, U1)).toEqual([]);
  });

  it("lists the latest matches per alert, skipping hidden vacancies", async () => {
    const mock = createSupabaseMock({
      resolve: () => ({
        data: [
          { saved_search_id: "a1", vacancy: V1 },
          { saved_search_id: "a1", vacancy: [V3] },
          { saved_search_id: "a1", vacancy: V4 },
          { saved_search_id: "a2", vacancy: null },
        ],
      }),
    });
    const matches = await listJobAlertMatches(mock.client as never, ["a1", "a2"], { perAlert: 2, now: NOW });

    expect(matches.get("a1")?.map((vacancy) => vacancy.id)).toEqual(["v1", "v3"]);
    expect(matches.has("a2")).toBe(false);
    expect(await listJobAlertMatches(mock.client as never, [])).toEqual(new Map());
    const failing = createSupabaseMock({ resolve: () => ({ error: { message: "x" } }) });
    expect(await listJobAlertMatches(failing.client as never, ["a1"])).toEqual(new Map());
  });

  it("names an alert from the filters and the names in the database", async () => {
    const mock = createSupabaseMock({
      resolve: (call) => ({ data: call.table === "skills" ? { name: "Figma" } : call.table === "countries" ? null : {} }),
    });
    expect(
      await nameJobAlert(mock.client as never, { type: "filters", filters: { ...NONE, kind: "freelance", skillId: 3, countryId: 9 } }, "en"),
    ).toBe("Freelance · Figma");
    expect(mock.calls.map((call) => call.table).sort()).toEqual(["countries", "skills"]);
    expect(await nameJobAlert(mock.client as never, { type: "profile" }, "en")).toBe("Vacancies that fit me");
  });

  it("creates, switches and removes", async () => {
    const ok = createSupabaseMock({ resolve: () => ({ data: ROW }) });
    expect(await createJobAlert(ok.client as never, U1, { target: { type: "profile" }, name: "x", notifyEmail: true })).toMatchObject({
      ok: true,
      alert: { id: "a1" },
    });
    expect(ok.calls[0].payload).toEqual({ user_id: U1, name: "x", mode: "vacancies", params: { match: "profile" }, notify_email: true });

    const none = createSupabaseMock({ resolve: () => ({ data: null }) });
    expect(await createJobAlert(none.client as never, U1, { target: { type: "profile" }, name: "x", notifyEmail: true })).toEqual({
      ok: false,
      code: "invalid",
    });
    const missing = createSupabaseMock({ resolve: () => ({ error: { code: "42703", message: "column" } }) });
    expect(await createJobAlert(missing.client as never, U1, { target: { type: "profile" }, name: "x", notifyEmail: true })).toEqual({
      ok: false,
      code: "unavailable",
    });

    const updated = createSupabaseMock({ resolve: () => ({ data: [{ id: "a1" }] }) });
    expect(await setJobAlertEmail(updated.client as never, U1, "a1", true)).toBe(true);
    expect(await deleteJobAlert(updated.client as never, U1, "a1")).toBe(true);
    const nothing = createSupabaseMock({ resolve: () => ({ data: null }) });
    expect(await setJobAlertEmail(nothing.client as never, U1, "a1", true)).toBe(false);
    expect(await deleteJobAlert(nothing.client as never, U1, "a1")).toBe(false);
  });

  it("turns every email off with the service key, and says when it can't", async () => {
    expect(await turnOffJobAlertEmails(U1)).toBe(false);

    holder.admin = createSupabaseMock({ resolve: () => ({}) });
    expect(await turnOffJobAlertEmails(U1)).toBe(true);
    expect(holder.admin.calls[0]).toMatchObject({ table: "saved_searches", verb: "update", payload: { notify_email: false } });

    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    holder.admin = createSupabaseMock({ resolve: () => ({ error: { message: "down" } }) });
    expect(await turnOffJobAlertEmails(U1)).toBe(false);
    spy.mockRestore();
  });
});
