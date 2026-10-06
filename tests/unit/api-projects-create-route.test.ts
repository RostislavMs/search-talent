import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/rate-limit", () => ({
  dbRateLimit: vi.fn(async () => null),
  rateLimit: vi.fn(() => null),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  generateUniqueProjectSlug: vi.fn(async () => "unique-slug"),
}));
vi.mock("@/lib/rich-text", () => ({ sanitizeRichTextHtml: (s: string) => s }));
vi.mock("@/lib/db/github-integrations", () => ({ getIntegrationForUser: vi.fn(async () => null) }));
vi.mock("@/lib/integrations/github", () => ({ fetchRepoFullDetail: vi.fn(async () => null) }));
vi.mock("@/lib/db/github-sync", () => ({ mapRepoToProjectColumns: vi.fn(() => ({})) }));
vi.mock("@/lib/db/publish-events", () => ({ dispatchPublishSideEffects: vi.fn() }));
vi.mock("@/lib/db/moderation-actions", () => ({
  readAutoModerationReason: vi.fn(async () => "flagged reason"),
}));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: vi.fn(async () => "en") }));
vi.mock("@/lib/db/save-project", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/save-project")>()),
  saveProject: vi.fn(),
  notifyProjectSaved: vi.fn(async () => undefined),
}));
vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/projects/route";
import { NextResponse } from "next/server";
import { dbRateLimit } from "@/lib/rate-limit";
import { readAutoModerationReason } from "@/lib/db/moderation-actions";
import { dispatchPublishSideEffects } from "@/lib/db/publish-events";
import { notifyProjectSaved, saveProject } from "@/lib/db/save-project";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CO_AUTHOR = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };
const base = { title: "My New Project" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}

function okResolver(): QueryResult {
  return { error: null };
}

function saved(status = "published", autoRemoved = false) {
  return {
    project: {
      id: PROJECT_ID,
      slug: "unique-slug",
      status,
      moderationStatus: autoRemoved ? "removed" : "approved",
      autoRemoved,
      invited: [],
      companyRequests: [],
    },
    error: null,
  } as never;
}

/** What the route asked save_project for. */
function saveInput() {
  return vi.mocked(saveProject).mock.calls[0]?.[1] as {
    id: string | null;
    row: Record<string, unknown>;
    skillIds: number[];
    budget: unknown;
    coAuthorIds: string[] | null;
    companyIds: string[] | null;
  };
}

function req(body: unknown = base): Request {
  return new Request("http://test/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
  vi.mocked(saveProject).mockResolvedValue(saved());
});

describe("POST /api/projects — rate limiting", () => {
  it("429 when the content-creation rate limit trips", async () => {
    setMock(authUser, okResolver);
    vi.mocked(dbRateLimit).mockResolvedValueOnce(
      NextResponse.json({ error: "Too many" }, { status: 429 }),
    );
    expect((await POST(req())).status).toBe(429);
  });
});

describe("POST /api/projects", () => {
  it("401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    expect((await POST(req())).status).toBe(401);
  });

  it("400 on an invalid payload", async () => {
    setMock(authUser, okResolver);
    expect((await POST(req({ title: "" }))).status).toBe(400);
  });

  it("saves a new project in one call", async () => {
    setMock(authUser, okResolver);
    const res = await POST(req());
    expect(res.status).toBe(200);
    const input = saveInput();
    expect(input.id).toBeNull();
    expect(input.row).toMatchObject({ title: "My New Project", slug: "unique-slug", publish_on_confirm: false });
    expect(input.row).not.toHaveProperty("owner_id");
    expect(input).toMatchObject({ budget: null, coAuthorIds: [], companyIds: [] });
    expect(notifyProjectSaved).toHaveBeenCalledWith(
      expect.objectContaining({ title: "My New Project", creatorUserId: USER_ID }),
    );
  });

  it("passes for whom and for how much, the budget and the company pages", async () => {
    setMock(authUser, okResolver);
    const companyId = "44444444-4444-4444-8444-444444444444";
    const budget = { amount: 8000, currency: "uah", type: "fixed", isPublic: false };
    const res = await POST(
      req({ ...base, origin: "client", clientName: "Acme", clientNda: false, budget, companyIds: [companyId] }),
    );
    expect(res.status).toBe(200);
    const input = saveInput();
    expect(input.row).toMatchObject({ origin: "client", client_name: "Acme", client_nda: false });
    expect(input.row).not.toHaveProperty("budget");
    expect(input.budget).toEqual(budget);
    expect(input.companyIds).toEqual([companyId]);
  });

  it("tells the author when the database took the project down", async () => {
    vi.mocked(saveProject).mockResolvedValue(saved("published", true));
    setMock(authUser, okResolver);
    const res = await POST(req({ ...base, coAuthorUserIds: [CO_AUTHOR] }));
    expect(res.status).toBe(200);
    // The database decides what a removed project shares; the route asks for all.
    expect(saveInput()).toMatchObject({ coAuthorIds: [CO_AUTHOR] });
    const body = await res.json();
    expect(body).toMatchObject({ autoRemoved: true, moderationReason: "flagged reason" });
    expect(readAutoModerationReason).toHaveBeenCalledWith(expect.anything(), "project", PROJECT_ID, "en");
    expect(dispatchPublishSideEffects).not.toHaveBeenCalled();
  });

  it("tells followers about a clean published project", async () => {
    setMock(authUser, okResolver);
    const body = await (await POST(req())).json();
    expect(body).toMatchObject({ autoRemoved: false, moderationReason: null });
    expect(dispatchPublishSideEffects).toHaveBeenCalledWith(expect.objectContaining({ contentId: PROJECT_ID }));
    expect(readAutoModerationReason).not.toHaveBeenCalled();
  });

  it("holds as a draft and invites co-authors when provided", async () => {
    setMock(authUser, okResolver);
    vi.mocked(saveProject).mockResolvedValue(saved("draft"));
    const res = await POST(req({ ...base, coAuthorUserIds: [CO_AUTHOR] }));
    expect(res.status).toBe(200);
    const input = saveInput();
    expect(input.row).toMatchObject({ status: "draft", publish_on_confirm: true });
    expect(input.coAuthorIds).toEqual([CO_AUTHOR]);
    expect((await res.json()).awaitingCoAuthors).toBe(true);
  });

  it("maps a save error to 400 and notifies nobody", async () => {
    setMock(authUser, okResolver);
    vi.mocked(saveProject).mockResolvedValue({ project: null, error: { message: "insert boom" } } as never);
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("insert boom");
    expect(notifyProjectSaved).not.toHaveBeenCalled();
  });
});
