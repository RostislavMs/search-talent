import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall, type QueryResult, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { admin: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => holder.admin?.client ?? null),
}));
vi.mock("@/lib/db/notifications", () => ({
  createNotifications: vi.fn(async () => undefined),
}));
vi.mock("@/lib/email/resend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/resend")>();
  return { ...actual, sendEmail: vi.fn(async () => ({ sent: true })) };
});

import {
  countMyApplications,
  countVacancyApplications,
  getApplicantContactPreview,
  getApplyContext,
  getMyApplicationForVacancy,
  hasVacancyApplications,
  listApplicableProjects,
  listMyApplications,
  listTeamApplications,
  notifyApplicationReceived,
  notifyApplicationStatus,
  notifyApplicationsViewed,
  purgeOldApplications,
} from "@/lib/db/applications";
import { createNotifications } from "@/lib/db/notifications";
import { sendEmail } from "@/lib/email/resend";
import { getSiteUrl } from "@/lib/seo";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const VACANCY_ID = "22222222-2222-4222-8222-222222222222";
const APPLICATION_ID = "33333333-3333-4333-8333-333333333333";
const COMPANY_ID = "44444444-4444-4444-8444-444444444444";
const AUTHOR_ID = "55555555-5555-4555-8555-555555555555";
const OWNER_ID = "66666666-6666-4666-8666-666666666666";

function client(resolve: (call: QueryCall) => QueryResult, rpc?: (fn: string, args?: unknown) => QueryResult) {
  return createSupabaseMock({ user: null, resolve, rpc });
}

function project(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    title: `Project ${id}`,
    slug: `project-${id}`,
    cover_url: null,
    kind: "web",
    status: "published",
    moderation_status: "approved",
    ...patch,
  };
}

const filterValue = (call: QueryCall, method: string, column: string) =>
  call.filters.find((filter) => filter.method === method && filter.args[0] === column)?.args[1];

afterEach(() => {
  holder.admin = null;
  vi.clearAllMocks();
});

describe("what the candidate can apply with", () => {
  it("lists their own published projects first, then the co-authored ones", async () => {
    const mock = client((call) => {
      if (call.table === "project_authors") return { data: [{ project_id: "c1" }, { project_id: "o1" }, { project_id: "c2" }] };
      if (call.table === "projects" && filterValue(call, "eq", "owner_id")) {
        return { data: [project("o1"), project("o2"), project("o3", { status: "draft" })] };
      }
      if (call.table === "projects") return { data: [project("c2"), project("c1"), project("c3", { moderation_status: "removed" })] };
      return {};
    });

    const projects = await listApplicableProjects(mock.client as never, USER_ID);
    expect(projects.map((item) => item.id)).toEqual(["o1", "o2", "c1", "c2"]);
    expect(projects[0]).toEqual({ id: "o1", title: "Project o1", slug: "project-o1", coverUrl: null, kind: "web" });

    const shared = mock.calls.find((call) => call.table === "projects" && !filterValue(call, "eq", "owner_id"));
    expect(shared?.filters.find((filter) => filter.method === "in")?.args[1]).toEqual(["c1", "c2"]);
  });

  it("does not ask for co-authored projects when there are none", async () => {
    const mock = client((call) => (call.table === "projects" ? { data: [project("o1")] } : { data: [] }));
    expect((await listApplicableProjects(mock.client as never, USER_ID)).map((item) => item.id)).toEqual(["o1"]);
    expect(mock.calls.filter((call) => call.table === "projects")).toHaveLength(1);
  });

  it("previews the profile's contact email, or the account's, and the phone", async () => {
    const withDetails = client(() => ({ data: { contact_email: "  me@work.dev ", phone: " +380 50 " } }));
    expect(await getApplicantContactPreview(withDetails.client as never, { id: USER_ID, email: "me@gmail.com" })).toEqual({
      email: "me@work.dev",
      phone: "+380 50",
    });

    const without = client(() => ({ data: null }));
    expect(await getApplicantContactPreview(without.client as never, { id: USER_ID, email: "me@gmail.com" })).toEqual({
      email: "me@gmail.com",
      phone: null,
    });
    expect(await getApplicantContactPreview(without.client as never, { id: USER_ID })).toEqual({
      email: null,
      phone: null,
    });
  });

  it("knows whether there is a public profile", async () => {
    const context = (profile: unknown) =>
      getApplyContext(
        client((call) => (call.table === "profiles" ? { data: profile } : { data: [] })).client as never,
        { id: USER_ID, email: "me@gmail.com" },
      );

    expect((await context({ username: "me", moderation_status: "approved" })).hasProfile).toBe(true);
    expect((await context({ username: "me", moderation_status: null })).hasProfile).toBe(true);
    expect((await context({ username: null, moderation_status: "approved" })).hasProfile).toBe(false);
    expect((await context({ username: "me", moderation_status: "restricted" })).hasProfile).toBe(false);
    const empty = await context(null);
    expect(empty).toEqual({ hasProfile: false, projects: [], contacts: { email: "me@gmail.com", phone: null } });
  });
});

describe("the candidate's own applications", () => {
  it("finds the application to one vacancy", async () => {
    const mock = client(() => ({ data: { id: APPLICATION_ID, status: "viewed", created_at: "2026-10-02T10:00:00Z" } }));
    expect(await getMyApplicationForVacancy(mock.client as never, USER_ID, VACANCY_ID)).toEqual({
      id: APPLICATION_ID,
      status: "viewed",
      createdAt: "2026-10-02T10:00:00Z",
    });
    const call = mock.calls[0];
    expect(filterValue(call, "eq", "vacancy_id")).toBe(VACANCY_ID);
    expect(filterValue(call, "eq", "applicant_user_id")).toBe(USER_ID);

    expect(await getMyApplicationForVacancy(client(() => ({ error: { message: "no table" } })).client as never, USER_ID, VACANCY_ID)).toBeNull();
  });

  it("counts them, 0 on error", async () => {
    expect(await countMyApplications(client(() => ({ count: 4 })).client as never, USER_ID)).toBe(4);
    expect(await countMyApplications(client(() => ({ error: { message: "x" } })).client as never, USER_ID)).toBe(0);
    expect(await hasVacancyApplications(client(() => ({ count: 1 })).client as never, USER_ID)).toBe(true);
    expect(await hasVacancyApplications(client(() => ({ count: 0 })).client as never, USER_ID)).toBe(false);
  });

  it("lists them with the vacancy's state and the projects that still exist", async () => {
    const now = Date.parse("2026-10-02T12:00:00Z");
    const mock = client((call) => {
      if (call.table === "vacancy_applications") {
        return {
          data: [
            {
              id: "a1",
              status: "shortlisted",
              project_ids: ["p2", "gone", "p1"],
              created_at: "2026-10-01T10:00:00Z",
              status_changed_at: "2026-10-02T09:00:00Z",
              vacancy: {
                id: VACANCY_ID,
                slug: "designer-abc",
                title: "Designer",
                status: "published",
                expires_at: "2026-10-01T00:00:00Z",
                company: [{ slug: "acme", name: "Acme", logo_url: null }],
              },
            },
            {
              id: "a2",
              status: "withdrawn",
              project_ids: [],
              created_at: "2026-09-01T10:00:00Z",
              status_changed_at: null,
              vacancy: null,
            },
          ],
        };
      }
      if (call.table === "projects") return { data: [project("p1"), project("p2")] };
      return {};
    });

    const items = await listMyApplications(mock.client as never, USER_ID, now);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "a1",
      status: "shortlisted",
      statusChangedAt: "2026-10-02T09:00:00Z",
      vacancy: { slug: "designer-abc", state: "expired", company: { slug: "acme", name: "Acme", logoUrl: null } },
    });
    expect(items[0].projects.map((item) => item.id)).toEqual(["p2", "p1"]);
    expect(items[1]).toMatchObject({ id: "a2", status: "withdrawn", vacancy: null, projects: [] });
  });

  it("is empty when the read fails", async () => {
    expect(await listMyApplications(client(() => ({ error: { message: "x" } })).client as never, USER_ID)).toEqual([]);
  });
});

describe("the team's list", () => {
  it("joins the profile, the chosen projects and the contacts", async () => {
    const mock = client(
      (call) => {
        if (call.table === "vacancy_applications") {
          return {
            data: [
              {
                id: "a1",
                status: "new",
                message: "Hi",
                project_ids: ["p1"],
                created_at: "2026-10-02T10:00:00Z",
                viewed_at: null,
                withdrawn_at: null,
                applicant_user_id: "u1",
              },
              {
                id: "a2",
                status: "withdrawn",
                message: null,
                project_ids: null,
                created_at: "2026-10-01T10:00:00Z",
                viewed_at: "2026-10-01T11:00:00Z",
                withdrawn_at: "2026-10-01T12:00:00Z",
                applicant_user_id: "u2",
              },
            ],
          };
        }
        if (call.table === "profiles") {
          return {
            data: [
              { user_id: "u1", username: "carol", name: "Carol", avatar_url: null, headline: "Designer", open_to: ["job", "x"] },
              { user_id: "u2", username: null, name: "Hidden", avatar_url: null, headline: null, open_to: null },
            ],
          };
        }
        if (call.table === "projects") return { data: [project("p1")] };
        return {};
      },
      (fn) =>
        fn === "vacancy_application_contacts"
          ? { data: [{ application_id: "a1", email: "carol@work.dev", phone: null }] }
          : {},
    );
    const rpc = vi.spyOn(mock.client, "rpc");

    const items = await listTeamApplications(mock.client as never, VACANCY_ID);
    expect(rpc).toHaveBeenCalledWith("vacancy_application_contacts", { p_vacancy_id: VACANCY_ID });
    expect(items[0]).toEqual({
      id: "a1",
      status: "new",
      message: "Hi",
      projects: [{ id: "p1", title: "Project p1", slug: "project-p1", coverUrl: null, kind: "web" }],
      createdAt: "2026-10-02T10:00:00Z",
      viewedAt: null,
      withdrawnAt: null,
      applicantUserId: "u1",
      applicant: {
        userId: "u1",
        username: "carol",
        name: "Carol",
        avatarUrl: null,
        headline: "Designer",
        openTo: ["job"],
      },
      contacts: { email: "carol@work.dev", phone: null },
    });
    // No username, no page to link to: shown as a hidden profile.
    expect(items[1]).toMatchObject({ status: "withdrawn", message: "", projects: [], applicant: null, contacts: null });
  });

  it("asks for nothing more when there are no applications", async () => {
    const mock = client(() => ({ data: [] }));
    expect(await listTeamApplications(mock.client as never, VACANCY_ID)).toEqual([]);
    expect(mock.calls).toHaveLength(1);
  });

  it("counts applications per vacancy in the database", async () => {
    const mock = client(
      () => ({}),
      () => ({ data: [{ vacancy_id: "v1", total: "3", fresh: 1 }] }),
    );
    const rpc = vi.spyOn(mock.client, "rpc");
    const counts = await countVacancyApplications(mock.client as never, ["v1", "v2"]);
    expect(rpc).toHaveBeenCalledWith("vacancy_application_counts", { p_vacancy_ids: ["v1", "v2"] });
    expect(counts.get("v1")).toEqual({ total: 3, fresh: 1 });
    expect(counts.has("v2")).toBe(false);

    expect((await countVacancyApplications(mock.client as never, [])).size).toBe(0);
    const failing = client(() => ({}), () => ({ error: { message: "missing" } }));
    expect((await countVacancyApplications(failing.client as never, ["v1"])).size).toBe(0);
  });
});

describe("notifications and email", () => {
  function adminWith({ members = [{ user_id: AUTHOR_ID, role: "recruiter" }, { user_id: OWNER_ID, role: "owner" }] } = {}) {
    const mock = client((call) => {
      if (call.table === "vacancies") {
        return {
          data: {
            id: VACANCY_ID,
            slug: "designer-abc",
            title: "Designer",
            company_id: COMPANY_ID,
            author_user_id: AUTHOR_ID,
          },
        };
      }
      if (call.table === "company_members") return { data: members };
      if (call.table === "companies") return { data: { slug: "acme", name: "Acme" } };
      if (call.table === "profiles") {
        const id = filterValue(call, "eq", "user_id");
        return { data: id === USER_ID ? { name: "Carol", username: "carol" } : { name: " ", username: "dan" } };
      }
      return {};
    });
    const getUserById = vi.fn(async (id: string) => ({
      data: {
        user:
          id === OWNER_ID
            ? { email: null, user_metadata: {} }
            : { email: `${id.slice(0, 4)}@example.com`, user_metadata: { locale: id === USER_ID ? "en" : "fr" } },
      },
    }));
    (mock.client.auth as unknown as { admin: unknown }).admin = { getUserById };
    holder.admin = mock;
    return { mock, getUserById };
  }

  const site = () => getSiteUrl().replace(/\/$/, "");

  it("does nothing without the service key", async () => {
    await notifyApplicationReceived({ applicationId: APPLICATION_ID, vacancyId: VACANCY_ID, applicantUserId: USER_ID });
    await notifyApplicationStatus({ applicationId: APPLICATION_ID, vacancyId: VACANCY_ID, applicantUserId: USER_ID, notice: "hired" });
    await notifyApplicationsViewed([{ application_id: APPLICATION_ID, applicant_user_id: USER_ID, vacancy_id: VACANCY_ID }]);
    expect(createNotifications).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("tells the vacancy's author about a new application, by notification and email", async () => {
    adminWith();
    await notifyApplicationReceived({ applicationId: APPLICATION_ID, vacancyId: VACANCY_ID, applicantUserId: USER_ID });

    expect(createNotifications).toHaveBeenCalledOnce();
    const [, rows] = vi.mocked(createNotifications).mock.calls[0];
    expect(rows).toEqual([
      {
        recipientUserId: AUTHOR_ID,
        actorUserId: USER_ID,
        type: "application_received",
        targetType: "vacancy_application",
        targetId: APPLICATION_ID,
        metadata: expect.objectContaining({
          applicationId: APPLICATION_ID,
          vacancyId: VACANCY_ID,
          vacancyTitle: "Designer",
          companyName: "Acme",
        }),
      },
    ]);

    expect(sendEmail).toHaveBeenCalledOnce();
    const message = vi.mocked(sendEmail).mock.calls[0][0];
    expect(message.to).toBe("5555@example.com");
    // An unknown locale in the account falls back to the default one.
    expect(message.subject).toBe("Новий відгук на «Designer»");
    expect(message.html).toContain(`${site()}/uk/my-space/vacancies/${VACANCY_ID}`);
    expect(message.text).toContain("Carol");
  });

  it("falls back to owners and admins when the author left, skipping those without an email", async () => {
    adminWith({ members: [{ user_id: OWNER_ID, role: "owner" }, { user_id: "77777777-7777-4777-8777-777777777777", role: "admin" }] });
    await notifyApplicationReceived({ applicationId: APPLICATION_ID, vacancyId: VACANCY_ID, applicantUserId: USER_ID });

    const [, rows] = vi.mocked(createNotifications).mock.calls[0];
    expect((rows as Array<{ recipientUserId: string }>).map((row) => row.recipientUserId)).toEqual([
      OWNER_ID,
      "77777777-7777-4777-8777-777777777777",
    ]);
    // The owner has no email on file.
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe("7777@example.com");
  });

  it("never throws", async () => {
    const { getUserById } = adminWith();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getUserById.mockRejectedValueOnce(new Error("auth down"));
    await expect(
      notifyApplicationReceived({ applicationId: APPLICATION_ID, vacancyId: VACANCY_ID, applicantUserId: USER_ID }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it("tells the candidate about a decision, with an email in their language", async () => {
    adminWith();
    await notifyApplicationStatus({
      applicationId: APPLICATION_ID,
      vacancyId: VACANCY_ID,
      applicantUserId: USER_ID,
      notice: "rejected",
    });

    expect(createNotifications).toHaveBeenCalledWith(expect.anything(), {
      recipientUserId: USER_ID,
      actorUserId: null,
      type: "application_status",
      targetType: "vacancy_application",
      targetId: APPLICATION_ID,
      metadata: expect.objectContaining({ applicationStatus: "rejected", companyName: "Acme" }),
    });
    const message = vi.mocked(sendEmail).mock.calls[0][0];
    expect(message.to).toBe("1111@example.com");
    expect(message.subject).toBe("Your application to “Designer”");
    expect(message.html).toContain(`${site()}/en/my-space/applications`);
    expect(message.text).toContain("Hi, Carol!");
  });

  it("tells about a first look without an email", async () => {
    adminWith();
    await notifyApplicationsViewed([
      { application_id: "a1", applicant_user_id: USER_ID, vacancy_id: VACANCY_ID },
      { application_id: "a2", applicant_user_id: AUTHOR_ID, vacancy_id: VACANCY_ID },
    ]);

    expect(createNotifications).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createNotifications).mock.calls[0][1]).toMatchObject({
      type: "application_status",
      targetId: "a1",
      metadata: { applicationStatus: "viewed" },
    });
    expect(sendEmail).not.toHaveBeenCalled();
    // The vacancy is read once for both.
    expect(holder.admin!.calls.filter((call) => call.table === "vacancies")).toHaveLength(1);
  });

  it("does nothing for an empty batch", async () => {
    adminWith();
    await notifyApplicationsViewed([]);
    expect(holder.admin!.calls).toHaveLength(0);
  });
});

describe("purgeOldApplications", () => {
  it("is 0 without the service key", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await purgeOldApplications()).toBe(0);
    spy.mockRestore();
  });

  it("runs the database function and says how many went", async () => {
    holder.admin = client(() => ({}), (fn) => (fn === "purge_old_vacancy_applications" ? { data: 4 } : {}));
    expect(await purgeOldApplications()).toBe(4);
  });

  it("throws when the database refuses", async () => {
    holder.admin = client(() => ({}), () => ({ error: { message: "nope" } }));
    await expect(purgeOldApplications()).rejects.toThrow("nope");
  });
});
