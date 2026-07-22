import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

// Shared holder so the vi.mock factory and each test point at one instance.
const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => holder.mock!.client),
}));
vi.mock("@/lib/rate-limit", () => ({ dbRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/db/project-votes", () => ({
  getProjectVoteSummary: vi.fn(async () => ({ likes: 3, dislikes: 1, currentVote: 1 })),
}));
vi.mock("@/lib/db/leaderboards", () => ({ LEADERBOARDS_CACHE_TAG: "leaderboards" }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

import { POST } from "@/app/api/vote/route";
import { dbRateLimit } from "@/lib/rate-limit";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_OWNER = "33333333-3333-4333-8333-333333333333";

const confirmedUser: MockUser = {
  id: USER_ID,
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
};

function setMock(user: MockUser, resolve: (table: string, verb: string) => QueryResult) {
  holder.mock = createSupabaseMock({
    user,
    resolve: (call) => resolve(call.table, call.verb),
  });
  return holder.mock;
}

function voteRequest(body: unknown): Request {
  return new Request("http://test/api/vote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(dbRateLimit).mockResolvedValue(null);
});

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/vote — auth guards", () => {
  it("returns 401 when unauthenticated", async () => {
    setMock(null, () => ({}));
    const res = await POST(voteRequest({ projectId: PROJECT_ID, value: 1 }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the email is not confirmed", async () => {
    setMock({ id: USER_ID, email_confirmed_at: null }, () => ({}));
    const res = await POST(voteRequest({ projectId: PROJECT_ID, value: 1 }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate-limited", async () => {
    setMock(confirmedUser, () => ({}));
    vi.mocked(dbRateLimit).mockResolvedValueOnce(
      NextResponse.json({ error: "Too many" }, { status: 429 }),
    );
    const res = await POST(voteRequest({ projectId: PROJECT_ID, value: 1 }));
    expect(res.status).toBe(429);
  });
});

describe("POST /api/vote — validation & project checks", () => {
  it("returns 400 for an invalid vote value", async () => {
    setMock(confirmedUser, () => ({}));
    const res = await POST(voteRequest({ projectId: PROJECT_ID, value: 5 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the project does not exist", async () => {
    setMock(confirmedUser, (table) => (table === "projects" ? { data: null } : {}));
    const res = await POST(voteRequest({ projectId: PROJECT_ID, value: 1 }));
    expect(res.status).toBe(404);
  });

  it("returns 400 (self-vote) when the caller owns the project", async () => {
    setMock(confirmedUser, (table) =>
      table === "projects" ? { data: { id: PROJECT_ID, owner_id: USER_ID } } : {},
    );
    const res = await POST(voteRequest({ projectId: PROJECT_ID, value: 1 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/your own project/i);
  });
});

describe("POST /api/vote — vote mutations", () => {
  const otherOwnersProject = (table: string): QueryResult =>
    table === "projects" ? { data: { id: PROJECT_ID, owner_id: OTHER_OWNER } } : {};

  it("inserts a new vote when none exists", async () => {
    const mock = setMock(confirmedUser, (table, verb) => {
      if (table === "projects") return otherOwnersProject(table);
      if (table === "votes" && verb === "select") return { data: [] };
      return { error: null };
    });
    const res = await POST(voteRequest({ projectId: PROJECT_ID, value: 1 }));
    expect(res.status).toBe(200);

    const insert = mock.calls.find((c) => c.table === "votes" && c.verb === "insert");
    expect(insert?.payload).toMatchObject({
      project_id: PROJECT_ID,
      user_id: USER_ID,
      value: 1,
    });
  });

  it("deletes the vote when the same value is re-submitted (toggle off)", async () => {
    const mock = setMock(confirmedUser, (table, verb) => {
      if (table === "projects") return otherOwnersProject(table);
      if (table === "votes" && verb === "select") return { data: [{ value: 1 }] };
      return { error: null };
    });
    const res = await POST(voteRequest({ projectId: PROJECT_ID, value: 1 }));
    expect(res.status).toBe(200);
    expect(mock.calls.some((c) => c.table === "votes" && c.verb === "delete")).toBe(true);
  });

  it("updates the vote when switching direction", async () => {
    const mock = setMock(confirmedUser, (table, verb) => {
      if (table === "projects") return otherOwnersProject(table);
      if (table === "votes" && verb === "select") return { data: [{ value: -1 }] };
      return { error: null };
    });
    const res = await POST(voteRequest({ projectId: PROJECT_ID, value: 1 }));
    expect(res.status).toBe(200);

    const update = mock.calls.find((c) => c.table === "votes" && c.verb === "update");
    expect(update?.payload).toMatchObject({ value: 1 });
  });

  it("maps a database error to a 400", async () => {
    setMock(confirmedUser, (table, verb) => {
      if (table === "projects") return otherOwnersProject(table);
      if (table === "votes" && verb === "select") return { data: [] };
      return { error: { message: "insert failed" } };
    });
    const res = await POST(voteRequest({ projectId: PROJECT_ID, value: 1 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("insert failed");
  });
});
