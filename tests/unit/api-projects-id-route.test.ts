import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  generateUniqueProjectSlug: vi.fn(async () => "fresh-slug"),
}));
vi.mock("@/lib/rich-text", () => ({ sanitizeRichTextHtml: (s: string) => s }));
vi.mock("@/lib/storage/provider", () => ({ deleteStorageObject: vi.fn(async () => ({ error: null })) }));
vi.mock("@/lib/db/publish-events", () => ({ dispatchPublishSideEffects: vi.fn() }));
vi.mock("@/lib/auto-moderation", () => ({
  CLEAN_MODERATION_RESULT: { flagged: false, note: "" },
  collectProjectModerationText: () => "",
  screenContentForModeration: () => ({ flagged: false, note: "" }),
  describeModerationResult: () => "",
}));
vi.mock("@/lib/auto-moderation-apply", () => ({ autoRemoveContent: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "en") }));
vi.mock("@/lib/db/co-authors", () => ({ syncCoAuthors: vi.fn() }));

import { PATCH, DELETE } from "@/app/api/projects/[id]/route";
import { generateUniqueProjectSlug } from "@/lib/projects";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "99999999-9999-4999-8999-999999999999";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

// title "My Project" derives slug "my-project"; matches existing slug → stable.
const payload = { title: "My Project" };

function setMock(user: MockUser, resolve: (table: string, verb: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}

const params = () => ({ params: Promise.resolve({ id: PROJECT_ID }) });
function patchReq(body: unknown = payload): Request {
  return new Request(`http://test/api/projects/${PROJECT_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const delReq = () => new Request(`http://test/api/projects/${PROJECT_ID}`, { method: "DELETE" });

const existingProject = {
  id: PROJECT_ID,
  owner_id: USER_ID,
  slug: "my-project",
  moderation_status: "approved",
  followers_notified_at: "2026-01-01T00:00:00Z",
};

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("PATCH /api/projects/[id] — owner-only edit", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await PATCH(patchReq(), params())).status).toBe(401);
  });

  it("404 when the caller is not the owner", async () => {
    setMock(authUser, (table) =>
      table === "projects" ? { data: { ...existingProject, owner_id: OTHER_ID } } : {},
    );
    expect((await PATCH(patchReq(), params())).status).toBe(404);
  });

  it("400 on an invalid payload (empty title)", async () => {
    setMock(authUser, (table) => (table === "projects" ? { data: existingProject } : {}));
    expect((await PATCH(patchReq({ title: "" }), params())).status).toBe(400);
  });

  it("updates and keeps the slug stable when unchanged", async () => {
    const mock = setMock(authUser, (table, verb) => {
      if (table === "projects" && verb === "select") return { data: existingProject };
      if (table === "projects" && verb === "update") return { data: { slug: "my-project", status: "published" } };
      if (table === "project_skills") return { error: null };
      return {};
    });
    const res = await PATCH(patchReq(), params());
    expect(res.status).toBe(200);

    const update = mock.calls.find((c) => c.table === "projects" && c.verb === "update");
    expect((update?.payload as { slug: string }).slug).toBe("my-project");
    expect(vi.mocked(generateUniqueProjectSlug)).not.toHaveBeenCalled();
    // Old project_skills are cleared as part of the edit.
    expect(mock.calls.some((c) => c.table === "project_skills" && c.verb === "delete")).toBe(true);
  });

  it("regenerates the slug when the title (and slug) change", async () => {
    setMock(authUser, (table, verb) => {
      if (table === "projects" && verb === "select") return { data: existingProject };
      if (table === "projects" && verb === "update") return { data: { slug: "fresh-slug", status: "published" } };
      if (table === "project_skills") return { error: null };
      return {};
    });
    const res = await PATCH(patchReq({ title: "A Totally Different Name" }), params());
    expect(res.status).toBe(200);
    expect(vi.mocked(generateUniqueProjectSlug)).toHaveBeenCalledOnce();
  });
});

describe("DELETE /api/projects/[id] — owner-only", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await DELETE(delReq(), params())).status).toBe(401);
  });

  it("404 when the caller is not the owner", async () => {
    setMock(authUser, (table) =>
      table === "projects" ? { data: { id: PROJECT_ID, owner_id: OTHER_ID } } : {},
    );
    expect((await DELETE(delReq(), params())).status).toBe(404);
  });

  it("deletes the project and its media when owned", async () => {
    const mock = setMock(authUser, (table, verb) => {
      if (table === "projects" && verb === "select") return { data: { id: PROJECT_ID, owner_id: USER_ID } };
      if (table === "project_media") return { data: [] };
      if (table === "projects" && verb === "delete") return { error: null };
      return {};
    });
    const res = await DELETE(delReq(), params());
    expect(res.status).toBe(200);
    expect(mock.calls.some((c) => c.table === "projects" && c.verb === "delete")).toBe(true);
  });
});
