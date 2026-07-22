import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ dbRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/storage/r2", () => ({
  isR2Configured: vi.fn(() => true),
  createPresignedUploadUrl: vi.fn(async () => "https://r2.example/upload"),
  getR2PublicUrl: vi.fn((key: string) => `https://cdn.example/${key}`),
}));

import { POST } from "@/app/api/storage/presign/route";
import { dbRateLimit } from "@/lib/rate-limit";
import { isR2Configured, createPresignedUploadUrl } from "@/lib/storage/r2";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER = "99999999-9999-4999-8999-999999999999";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult = () => ({})) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}

function req(body: Record<string, unknown>): Request {
  return new Request("http://test/api/storage/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const avatar = { scope: "avatar", fileName: "me.png", contentType: "image/png", fileSize: 1024 };

beforeEach(() => {
  vi.mocked(isR2Configured).mockReturnValue(true);
  vi.mocked(dbRateLimit).mockResolvedValue(null);
});
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("POST /api/storage/presign", () => {
  it("503 when storage is not configured", async () => {
    vi.mocked(isR2Configured).mockReturnValue(false);
    setMock(authUser);
    expect((await POST(req(avatar))).status).toBe(503);
  });

  it("401 when unauthenticated", async () => {
    setMock(null);
    expect((await POST(req(avatar))).status).toBe(401);
  });

  it("returns the rate-limit response when limited", async () => {
    setMock(authUser);
    const { NextResponse } = await import("next/server");
    vi.mocked(dbRateLimit).mockResolvedValueOnce(NextResponse.json({ error: "slow" }, { status: 429 }));
    expect((await POST(req(avatar))).status).toBe(429);
  });

  it("400 on an invalid payload (unknown scope)", async () => {
    setMock(authUser);
    expect((await POST(req({ ...avatar, scope: "bogus" }))).status).toBe(400);
  });

  it("413 when the file exceeds the scope cap", async () => {
    setMock(authUser);
    // avatar cap is 10 MB.
    expect((await POST(req({ ...avatar, fileSize: 11 * 1024 * 1024 }))).status).toBe(413);
  });

  it("415 for a disallowed mime type", async () => {
    setMock(authUser);
    expect((await POST(req({ ...avatar, contentType: "application/zip" }))).status).toBe(415);
  });

  it("400 when project-media is requested without a projectId", async () => {
    setMock(authUser);
    const res = await POST(req({ scope: "project-media", fileName: "v.mp4", contentType: "video/mp4", fileSize: 1024 }));
    expect(res.status).toBe(400);
  });

  it("403 when uploading to a project the caller does not own", async () => {
    setMock(authUser, (table) => (table === "projects" ? { data: { owner_id: OWNER, kind: "photo" } } : {}));
    const res = await POST(
      req({ scope: "project-media", fileName: "v.mp4", contentType: "video/mp4", fileSize: 1024, projectId: PROJECT_ID }),
    );
    expect(res.status).toBe(403);
  });

  it("signs the upload for a valid avatar request", async () => {
    setMock(authUser);
    const res = await POST(req(avatar));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toBe("https://r2.example/upload");
    expect(body.storagePath).toContain(`avatars/${USER_ID}/avatar`);
    expect(vi.mocked(createPresignedUploadUrl)).toHaveBeenCalledOnce();
  });
});
