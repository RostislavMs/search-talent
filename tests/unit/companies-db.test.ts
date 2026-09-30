import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type QueryCall, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { admin: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => holder.admin?.client ?? null),
}));
vi.mock("@/lib/storage/r2", () => ({
  getR2PublicUrl: vi.fn((key: string) => `https://cdn.example/${key}`),
  isR2Configured: vi.fn(() => true),
  deleteFromR2: vi.fn(async () => undefined),
}));
vi.mock("@/lib/db/leaderboards", () => ({
  getProjectRatings: vi.fn(async () => ({ p1: 88 })),
}));
vi.mock("@/lib/db/notifications", () => ({
  createNotifications: vi.fn(async () => undefined),
}));

import {
  companyWriteErrorCode,
  deleteCompanyLogo,
  holdCompanyForReview,
  isCompanyLogoUrl,
  listCompanyTeam,
  listAttachableProjects,
  listCompanyProjects,
  companyVerificationCodeMatches,
  generateCompanyVerificationCode,
  hashCompanyVerificationCode,
  markCompanyVerifiedByEmail,
  listMyCompanies,
  listPendingCompanyInvitations,
  notifyCompanyInvite,
  notifyCompanyModeration,
  notifyCompanyVerified,
} from "@/lib/db/companies";
import { createNotifications } from "@/lib/db/notifications";
import { deleteFromR2 } from "@/lib/storage/r2";

const COMPANY_ID = "22222222-2222-4222-8222-222222222222";

function client(resolve: (call: QueryCall) => { data?: unknown; count?: number | null; error?: unknown }) {
  return createSupabaseMock({ user: null, resolve });
}

afterEach(() => {
  holder.admin = null;
  vi.clearAllMocks();
});

describe("isCompanyLogoUrl", () => {
  const own = `https://cdn.example/companies/${COMPANY_ID}/logo`;

  it("accepts the company's own key, with or without a numeric cache buster", () => {
    expect(isCompanyLogoUrl(own, COMPANY_ID)).toBe(true);
    expect(isCompanyLogoUrl(`${own}?v=1727700000000`, COMPANY_ID)).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isCompanyLogoUrl(`${own}?v=1&x=2`, COMPANY_ID)).toBe(false);
    expect(isCompanyLogoUrl(`${own}?x=1`, COMPANY_ID)).toBe(false);
    expect(isCompanyLogoUrl(`${own}-2`, COMPANY_ID)).toBe(false);
    expect(isCompanyLogoUrl("https://cdn.example/companies/other/logo", COMPANY_ID)).toBe(false);
    expect(isCompanyLogoUrl("https://evil.example/logo.png", COMPANY_ID)).toBe(false);
  });

  it("deletes the stable key only", async () => {
    await deleteCompanyLogo(COMPANY_ID);
    expect(deleteFromR2).toHaveBeenCalledWith(`companies/${COMPANY_ID}/logo`);
  });
});

describe("companyWriteErrorCode", () => {
  it("maps database errors", () => {
    expect(companyWriteErrorCode(null)).toBeNull();
    expect(companyWriteErrorCode({ code: "23505" })).toBe("slug_taken");
    expect(companyWriteErrorCode({ code: "P0001", message: "company_limit_reached" })).toBe("limit");
    expect(companyWriteErrorCode({ code: "42501" })).toBe("email_unconfirmed");
    expect(companyWriteErrorCode({ code: "23514" })).toBe("invalid");
  });
});

describe("holdCompanyForReview", () => {
  it("is a no-op without the service key", async () => {
    expect(await holdCompanyForReview(COMPANY_ID, "note")).toBe(false);
  });

  it("only moves an approved page to review", async () => {
    holder.admin = client(() => ({}));
    expect(await holdCompanyForReview(COMPANY_ID, "[авто] spam")).toBe(true);
    const update = holder.admin.calls[0];
    expect(update.payload).toMatchObject({ moderation_status: "under_review", moderation_note: "[авто] spam" });
    expect(update.filters).toEqual(
      expect.arrayContaining([{ method: "eq", args: ["moderation_status", "approved"] }]),
    );
  });
});

describe("listCompanyTeam", () => {
  const rows = [
    { id: "m1", company_id: COMPANY_ID, user_id: "u-recruiter", role: "recruiter", status: "accepted", invited_by: null, invited_at: "2026-09-01" },
    { id: "m2", company_id: COMPANY_ID, user_id: "u-pending", role: "admin", status: "pending", invited_by: "u-owner", invited_at: "2026-09-02" },
    { id: "m3", company_id: COMPANY_ID, user_id: "u-owner", role: "owner", status: "accepted", invited_by: null, invited_at: "2026-09-03" },
    { id: "m4", company_id: COMPANY_ID, user_id: "u-hidden", role: "admin", status: "accepted", invited_by: null, invited_at: "2026-09-04" },
  ];
  const profiles = ["u-recruiter", "u-pending", "u-owner"].map((userId) => ({
    user_id: userId,
    username: userId,
    name: null,
    avatar_url: null,
    headline: null,
  }));

  it("puts accepted owners first, invitations last, and drops hidden profiles", async () => {
    const mock = client((call) => (call.table === "company_members" ? { data: rows } : { data: profiles }));
    const team = await listCompanyTeam(mock.client as never, COMPANY_ID, { includePending: true });
    expect(team.map((member) => member.memberId)).toEqual(["m3", "m1", "m2"]);
    expect(mock.calls[0].filters).toEqual(
      expect.arrayContaining([{ method: "in", args: ["status", ["accepted", "pending"]] }]),
    );
  });

  it("asks for accepted members only by default", async () => {
    const mock = client((call) => (call.table === "company_members" ? { data: [] } : { data: [] }));
    await listCompanyTeam(mock.client as never, COMPANY_ID);
    expect(mock.calls[0].filters).toEqual(
      expect.arrayContaining([{ method: "in", args: ["status", ["accepted"]] }]),
    );
  });
});

describe("company projects", () => {
  const project = (patch: Record<string, unknown>) => ({
    id: "p1",
    title: "One",
    slug: "one",
    description: null,
    score: 10,
    cover_url: null,
    kind: "code",
    owner_id: "u1",
    status: "published",
    moderation_status: "approved",
    ...patch,
  });

  it("shows only attached projects that are published and visible, with the author", async () => {
    const mock = client((call) =>
      call.table === "company_projects"
        ? {
            data: [
              { project_id: "p1", status: "approved", confirmed_at: "2026-09-30", project: project({}) },
              { project_id: "p2", status: "pending", confirmed_at: null, project: [project({ id: "p2", slug: null, owner_id: "u2", score: 5 })] },
              { project_id: "p3", project: project({ id: "p3", status: "draft" }) },
              { project_id: "p4", project: project({ id: "p4", moderation_status: "removed" }) },
              { project_id: "p5", project: null },
            ],
          }
        : {
            data: [
              { user_id: "u1", username: "ann", name: "Ann", avatar_url: null, headline: null },
              { user_id: "u2", username: "bob", name: null, avatar_url: null, headline: null },
            ],
          },
    );
    const projects = await listCompanyProjects(mock.client as never, COMPANY_ID);
    expect(projects).toMatchObject([
      { id: "p1", score: 88, ownerId: "u1", ownerName: "Ann", ownerUsername: "ann", status: "approved", confirmed: true },
      { id: "p2", slug: "", score: 5, ownerUsername: "bob", status: "pending", confirmed: false },
    ]);
    expect(projects).toHaveLength(2);
    expect(mock.calls[0].filters).toEqual(
      expect.arrayContaining([{ method: "eq", args: ["company_id", COMPANY_ID] }]),
    );
  });

  it("returns nothing without attached projects, and skips the profile lookup", async () => {
    const mock = client(() => ({ data: [] }));
    expect(await listCompanyProjects(mock.client as never, COMPANY_ID)).toEqual([]);
    expect(mock.calls).toHaveLength(1);
  });

  it("offers only the person’s own published projects that are not attached yet", async () => {
    const mock = client(() => ({ data: [{ id: "p1", title: "One" }, { id: "p2", title: "Two" }] }));
    expect(await listAttachableProjects(mock.client as never, "u1", ["p1"])).toEqual([
      { id: "p2", title: "Two" },
    ]);
    expect(mock.calls[0].filters).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["owner_id", "u1"] },
        { method: "eq", args: ["status", "published"] },
        { method: "eq", args: ["moderation_status", "approved"] },
      ]),
    );
  });

});

describe("verification codes", () => {
  it("makes six-digit codes", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(generateCompanyVerificationCode()).toMatch(/^[0-9]{6}$/);
    }
  });

  it("binds the hash to the page and the person", () => {
    const hash = hashCompanyVerificationCode("123456", COMPANY_ID, "u1");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(companyVerificationCodeMatches("123456", COMPANY_ID, "u1", hash)).toBe(true);
    expect(companyVerificationCodeMatches("123457", COMPANY_ID, "u1", hash)).toBe(false);
    expect(companyVerificationCodeMatches("123456", COMPANY_ID, "u2", hash)).toBe(false);
    expect(companyVerificationCodeMatches("123456", "other", "u1", hash)).toBe(false);
    expect(companyVerificationCodeMatches("123456", COMPANY_ID, "u1", "abc")).toBe(false);
  });

  it("writes the mark only for the unchanged, unverified page", async () => {
    const mock = client(() => ({ data: [{ id: COMPANY_ID }] }));
    expect(
      await markCompanyVerifiedByEmail(mock.client as never, {
        companyId: COMPANY_ID,
        website: "https://acme.com",
        userId: "u1",
      }),
    ).toBe(true);
    expect(mock.calls[0].filters).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["website", "https://acme.com"] },
        { method: "is", args: ["verified_at", null] },
      ]),
    );
    const none = client(() => ({ data: [] }));
    expect(
      await markCompanyVerifiedByEmail(none.client as never, { companyId: COMPANY_ID, website: "x", userId: "u1" }),
    ).toBe(false);
  });
});

describe("listMyCompanies and invitations", () => {
  it("counts the accepted team of each company", async () => {
    const mock = client((call) => {
      const selected = String(call.modifiers.find((m) => m.method === "select")?.args[0] ?? "");
      if (selected.startsWith("role")) {
        return {
          data: [
            { role: "owner", company: { id: "c1", slug: "acme", name: "Acme", type: "company", logo_url: null, verified_at: "2026-09-01", moderation_status: "approved" } },
            { role: "recruiter", company: null },
          ],
        };
      }
      return { data: [{ company_id: "c1" }, { company_id: "c1" }] };
    });
    const companies = await listMyCompanies(mock.client as never, "u1");
    expect(companies).toEqual([
      expect.objectContaining({ id: "c1", role: "owner", verified: true, membersCount: 2 }),
    ]);
  });

  it("leaves out invitations to hidden companies and adds the inviter", async () => {
    const mock = client((call) =>
      call.table === "company_members"
        ? {
            data: [
              { id: "m1", role: "admin", invited_at: "2026-09-30", invited_by: "u2", company: [{ id: "c1", slug: "acme", name: "Acme", logo_url: null, verified_at: null }] },
              { id: "m2", role: "recruiter", invited_at: "2026-09-29", invited_by: "u3", company: null },
            ],
          }
        : { data: [{ user_id: "u2", username: "bob", name: "Bob", avatar_url: null, headline: null }] },
    );
    const invitations = await listPendingCompanyInvitations(mock.client as never, "u1");
    expect(invitations).toEqual([
      {
        memberId: "m1",
        role: "admin",
        invitedAt: "2026-09-30",
        company: { id: "c1", slug: "acme", name: "Acme", logoUrl: null, verified: false },
        inviter: { userId: "u2", username: "bob", name: "Bob", avatarUrl: null },
      },
    ]);
  });
});

describe("notifications", () => {
  function adminWith(company: { slug: string; name: string } | null, managers: string[] = []) {
    holder.admin = client((call) =>
      call.table === "companies"
        ? { data: company }
        : { data: managers.map((user_id) => ({ user_id })) },
    );
  }

  it("sends the invitation with the company in the metadata", async () => {
    adminWith({ slug: "acme", name: "Acme" });
    await notifyCompanyInvite({
      companyId: COMPANY_ID,
      memberId: "m1",
      inviteeUserId: "u2",
      actorUserId: "u1",
      role: "admin",
    });
    expect(createNotifications).toHaveBeenCalledWith(expect.anything(), {
      recipientUserId: "u2",
      actorUserId: "u1",
      type: "company_invite",
      targetType: "company",
      targetId: COMPANY_ID,
      metadata: {
        companyId: COMPANY_ID,
        companySlug: "acme",
        companyName: "Acme",
        invitationId: "m1",
        companyRole: "admin",
      },
    });
  });

  it("tells the managers about the mark, except the one who checked", async () => {
    adminWith({ slug: "acme", name: "Acme" }, ["u1", "u2"]);
    await notifyCompanyVerified({ companyId: COMPANY_ID, excludeUserId: "u1" });
    const [, list] = vi.mocked(createNotifications).mock.calls[0];
    expect(list).toEqual([
      expect.objectContaining({ recipientUserId: "u2", actorUserId: null, type: "company_verified" }),
    ]);
  });

  it("sends a moderation decision about the company to its managers", async () => {
    adminWith({ slug: "acme", name: "Acme" }, ["u1"]);
    await notifyCompanyModeration({ companyId: COMPANY_ID, status: "removed" });
    const [, list] = vi.mocked(createNotifications).mock.calls[0];
    expect(list).toEqual([
      expect.objectContaining({
        type: "moderation_decision",
        metadata: expect.objectContaining({ contentKind: "company", moderationStatus: "removed", contentTitle: "Acme" }),
      }),
    ]);
  });

  it("stays quiet without the service key or the company", async () => {
    await notifyCompanyVerified({ companyId: COMPANY_ID });
    adminWith(null, ["u1"]);
    await notifyCompanyModeration({ companyId: COMPANY_ID, status: "restricted" });
    expect(createNotifications).not.toHaveBeenCalled();
  });
});
