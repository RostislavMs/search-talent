import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rich-text", () => ({ sanitizeRichTextHtml: (s: string) => `clean:${s}` }));
vi.mock("@/lib/db/companies", () => ({
  notifyCompanyProjectRequest: vi.fn(async () => undefined),
}));
vi.mock("@/lib/db/co-authors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/co-authors")>()),
  notifyCoAuthorInvites: vi.fn(async () => undefined),
}));

import { notifyCompanyProjectRequest } from "@/lib/db/companies";
import { notifyCoAuthorInvites } from "@/lib/db/co-authors";
import {
  buildProjectRow,
  notifyProjectSaved,
  parseSavedProject,
  saveProject,
} from "@/lib/db/save-project";
import { projectPayloadSchema } from "@/lib/validation/project";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  vi.clearAllMocks();
});

describe("buildProjectRow", () => {
  it("maps the form to columns, sanitising the description", () => {
    const payload = projectPayloadSchema.parse({ title: "Night city", description: "<p>Hi</p>" });
    const row = buildProjectRow(payload);

    expect(row).toMatchObject({ title: "Night city", description: "clean:<p>Hi</p>" });
    // The database owns these; the route adds slug and status itself.
    for (const key of ["owner_id", "id", "slug", "status", "score", "budget"]) {
      expect(row).not.toHaveProperty(key);
    }
    // No display options in the form: the stored ones stay.
    expect(row).not.toHaveProperty("github_display_options");
  });
});

describe("saveProject", () => {
  it("sends everything to save_project in one call", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        id: PROJECT_ID,
        slug: "night-city",
        status: "draft",
        invited: [{ id: "inv1", userId: "u2" }, { id: 5 }],
        companyRequests: ["c1", 7],
      },
      error: null,
    }));
    const budget = { amount: 100, currency: "usd" as const, type: "fixed" as const, isPublic: true };

    const result = await saveProject({ rpc } as never, {
      id: null,
      row: { title: "Night city" },
      skillIds: [1, 2],
      budget,
      coAuthorIds: ["u2"],
      companyIds: null,
    });

    expect(rpc).toHaveBeenCalledWith("save_project", {
      p_id: null,
      p_row: { title: "Night city" },
      p_skill_ids: [1, 2],
      p_budget: budget,
      p_co_author_ids: ["u2"],
      p_company_ids: null,
    });
    expect(result.project).toEqual({
      id: PROJECT_ID,
      slug: "night-city",
      status: "draft",
      moderationStatus: "approved",
      autoRemoved: false,
      invited: [{ id: "inv1", userId: "u2" }],
      companyRequests: ["c1"],
    });
  });

  it("reads what auto-moderation did", () => {
    expect(
      parseSavedProject({
        id: PROJECT_ID,
        slug: "night-city",
        status: "published",
        moderation_status: "removed",
        auto_removed: true,
      }),
    ).toMatchObject({ moderationStatus: "removed", autoRemoved: true, invited: [], companyRequests: [] });
  });

  it("passes the database error on", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "at most 4", code: "23514" } }));
    const result = await saveProject({ rpc } as never, {
      id: PROJECT_ID,
      row: {},
      skillIds: [],
      budget: null,
      coAuthorIds: null,
      companyIds: null,
    });
    expect(result).toEqual({ project: null, error: { message: "at most 4", code: "23514" } });
  });

  it("reads a broken answer as no project", () => {
    expect(parseSavedProject(null)).toBeNull();
    expect(parseSavedProject({ id: PROJECT_ID })).toBeNull();
  });
});

describe("notifyProjectSaved", () => {
  const project = {
    id: PROJECT_ID,
    slug: "night-city",
    status: "published",
    moderationStatus: "approved",
    autoRemoved: false,
    invited: [{ id: "inv1", userId: "u2" }],
    companyRequests: ["c1", "c2"],
  };

  it("invites the new co-authors and asks each waiting company", async () => {
    await notifyProjectSaved({ project, title: "Night city", creatorUserId: "u1" });

    expect(notifyCoAuthorInvites).toHaveBeenCalledWith({
      contentType: "project",
      contentId: PROJECT_ID,
      contentTitle: "Night city",
      contentSlug: "night-city",
      creatorUserId: "u1",
      invited: project.invited,
    });
    expect(notifyCompanyProjectRequest).toHaveBeenCalledTimes(2);
    expect(notifyCompanyProjectRequest).toHaveBeenCalledWith({ companyId: "c1", projectId: PROJECT_ID, actorUserId: "u1" });
  });

  it("does not ask companies to look at a draft", async () => {
    await notifyProjectSaved({ project: { ...project, status: "draft" }, title: "Night city", creatorUserId: "u1" });
    expect(notifyCompanyProjectRequest).not.toHaveBeenCalled();
  });
});
