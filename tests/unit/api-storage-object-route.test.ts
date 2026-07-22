import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ dbRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/storage/provider", () => ({ deleteStorageObject: vi.fn(async () => ({ error: null })) }));

import { DELETE } from "@/app/api/storage/object/route";
import { dbRateLimit } from "@/lib/rate-limit";
import { deleteStorageObject } from "@/lib/storage/provider";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "99999999-9999-4999-8999-999999999999";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult = () => ({})) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb) });
  return holder.mock;
}

function req(body: Record<string, unknown>): Request {
  return new Request("http://test/api/storage/object", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const base = {
  bucket: "profile-certificates",
  storagePath: `certificates/${USER_ID}/cert.pdf`,
  url: "https://cdn.example/certificates/cert.pdf",
};

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("DELETE /api/storage/object", () => {
  it("401 when unauthenticated", async () => {
    setMock(null);
    expect((await DELETE(req(base))).status).toBe(401);
    expect(vi.mocked(deleteStorageObject)).not.toHaveBeenCalled();
  });

  it("429 when rate limited", async () => {
    setMock(authUser);
    vi.mocked(dbRateLimit).mockResolvedValueOnce(
      new Response(null, { status: 429 }) as never,
    );
    expect((await DELETE(req(base))).status).toBe(429);
  });

  it("400 on invalid payload", async () => {
    setMock(authUser);
    const res = await DELETE(req({ bucket: "", storagePath: "", url: "not-a-url" }));
    expect(res.status).toBe(400);
    expect(vi.mocked(deleteStorageObject)).not.toHaveBeenCalled();
  });

  it("400 for a bucket outside the allow-list", async () => {
    setMock(authUser);
    const res = await DELETE(req({ ...base, bucket: "secret-bucket" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Bucket not allowed" });
    expect(vi.mocked(deleteStorageObject)).not.toHaveBeenCalled();
  });

  it("deletes a file under the caller's own user prefix", async () => {
    setMock(authUser);
    const res = await DELETE(req(base));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(vi.mocked(deleteStorageObject)).toHaveBeenCalledTimes(1);
  });

  it("403 when the storage path belongs to another user", async () => {
    setMock(authUser);
    const res = await DELETE(
      req({ ...base, storagePath: `certificates/${OTHER_ID}/cert.pdf` }),
    );
    expect(res.status).toBe(403);
    expect(vi.mocked(deleteStorageObject)).not.toHaveBeenCalled();
  });

  it("allows project-media deletion when the caller owns the project", async () => {
    setMock(authUser, (table) =>
      table === "projects" ? { data: { owner_id: USER_ID } } : {},
    );
    const res = await DELETE(
      req({
        bucket: "project-media",
        storagePath: `${PROJECT_ID}/shot.png`,
        url: "https://cdn.example/shot.png",
        projectId: PROJECT_ID,
      }),
    );
    expect(res.status).toBe(200);
    expect(vi.mocked(deleteStorageObject)).toHaveBeenCalledTimes(1);
  });

  it("403 for project-media when the caller does not own the project", async () => {
    setMock(authUser, (table) =>
      table === "projects" ? { data: { owner_id: OTHER_ID } } : {},
    );
    const res = await DELETE(
      req({
        bucket: "project-media",
        storagePath: `${PROJECT_ID}/shot.png`,
        url: "https://cdn.example/shot.png",
        projectId: PROJECT_ID,
      }),
    );
    expect(res.status).toBe(403);
    expect(vi.mocked(deleteStorageObject)).not.toHaveBeenCalled();
  });

  it("403 when the path does not match the owned project id", async () => {
    setMock(authUser, (table) =>
      table === "projects" ? { data: { owner_id: USER_ID } } : {},
    );
    const res = await DELETE(
      req({
        bucket: "project-media",
        storagePath: `${OTHER_ID}/shot.png`,
        url: "https://cdn.example/shot.png",
        projectId: PROJECT_ID,
      }),
    );
    expect(res.status).toBe(403);
    expect(vi.mocked(deleteStorageObject)).not.toHaveBeenCalled();
  });

  it("400 when the provider delete fails", async () => {
    setMock(authUser);
    vi.mocked(deleteStorageObject).mockResolvedValueOnce({
      error: { message: "R2 down" },
    } as never);
    const res = await DELETE(req(base));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "R2 down" });
  });
});
