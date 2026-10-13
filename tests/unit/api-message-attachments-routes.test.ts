import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type QueryResult, type SupabaseMock } from "./helpers/supabase-mock";

const { holder, storage } = vi.hoisted(() => ({
  holder: {
    mock: null as SupabaseMock | null,
    rpcCalls: [] as Array<{ fn: string; args: unknown }>,
    adminCalls: [] as Array<{ fn: string; args: unknown }>,
    adminRpc: (() => ({ data: { status: "ok" } })) as (fn: string, args: unknown) => { data?: unknown; error?: unknown },
    admin: true,
    viewer: { user: null as { id: string } | null, isAdmin: false },
  },
  storage: {
    configured: true,
    object: { size: 2048, head: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]) } as { size: number; head: Uint8Array } | null,
    inspectError: null as Error | null,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() =>
    holder.admin
      ? {
          rpc: async (fn: string, args: unknown) => {
            holder.adminCalls.push({ fn, args });
            const result = holder.adminRpc(fn, args);
            return { data: result.data ?? null, error: result.error ?? null };
          },
        }
      : null,
  ),
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/moderation-server", () => ({
  getCurrentViewerRole: vi.fn(async () => ({ ...holder.viewer, supabase: holder.mock!.client })),
}));
vi.mock("@/lib/storage/r2", () => ({
  isPrivateStorageConfigured: vi.fn(() => storage.configured),
  createPrivateUploadUrl: vi.fn(async ({ key }: { key: string }) => `https://bucket.r2.test/${key}?put`),
  createPrivateDownloadUrl: vi.fn(async ({ key }: { key: string }) => `https://bucket.r2.test/${key}?get`),
  inspectPrivateObject: vi.fn(async () => {
    if (storage.inspectError) throw storage.inspectError;
    return storage.object;
  }),
  deleteFromPrivateR2: vi.fn(async () => undefined),
}));

import { GET as ADMIN_FILE } from "@/app/api/admin/message-attachments/[id]/route";
import { GET as FILE } from "@/app/api/messages/attachments/[id]/route";
import { POST as CREATE } from "@/app/api/messages/conversations/[id]/attachments/route";
import { DELETE as DISCARD, POST as CONFIRM } from "@/app/api/messages/conversations/[id]/attachments/[attachmentId]/route";
import { createPrivateDownloadUrl, createPrivateUploadUrl, deleteFromPrivateR2 } from "@/lib/storage/r2";

const USER = "11111111-1111-4111-8111-111111111111";
const CONV = "33333333-3333-4333-8333-333333333333";
const FILE_ID = "44444444-4444-4444-8444-444444444444";
const REPORT = "55555555-5555-4555-8555-555555555555";
const KEY = `messages/${CONV}/${FILE_ID}`;
const signedIn: MockUser = { id: USER, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, rpc: (fn: string, args: unknown) => QueryResult = () => ({})) {
  holder.rpcCalls = [];
  holder.mock = createSupabaseMock({
    user,
    resolve: () => ({}),
    rpc: (fn, args) => {
      holder.rpcCalls.push({ fn, args });
      return rpc(fn, args);
    },
  });
}

function json(url: string, method: string, body?: unknown) {
  return new Request(`http://test${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const conv = { params: Promise.resolve({ id: CONV }) };
const file = (id = FILE_ID) => ({ params: Promise.resolve({ id: CONV, attachmentId: id }) });
const byId = (id = FILE_ID) => ({ params: Promise.resolve({ id }) });
const pdf = { fileName: "cv.pdf", contentType: "application/pdf", size: 2048 };

afterEach(() => {
  holder.viewer = { user: null, isAdmin: false };
  holder.admin = true;
  holder.adminCalls = [];
  holder.adminRpc = () => ({ data: { status: "ok" } });
  storage.configured = true;
  storage.object = { size: 2048, head: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]) };
  storage.inspectError = null;
  vi.clearAllMocks();
});

describe("POST /api/messages/conversations/:id/attachments", () => {
  const create = (body: unknown) => CREATE(json("/x", "POST", body), conv);

  it("503 without the private bucket, 401 for a guest, 400 for a bad file", async () => {
    storage.configured = false;
    setMock(signedIn);
    expect((await create(pdf)).status).toBe(503);
    storage.configured = true;
    setMock(null);
    expect((await create(pdf)).status).toBe(401);
    setMock(signedIn);
    expect((await create({ ...pdf, contentType: "image/gif" })).status).toBe(400);
    expect((await create({ ...pdf, size: 10 * 1024 * 1024 + 1 })).status).toBe(400);
    expect(holder.rpcCalls).toHaveLength(0);
  });

  it("asks the database, then signs a PUT for exactly this type and size", async () => {
    setMock(signedIn, () => ({ data: { status: "ok", attachment_id: FILE_ID, storage_key: KEY } }));
    const res = await create({ ...pdf, width: null });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ attachmentId: FILE_ID, uploadUrl: `https://bucket.r2.test/${KEY}?put` });
    expect(holder.rpcCalls[0]).toEqual({
      fn: "create_message_attachment",
      args: {
        p_conversation_id: CONV,
        p_file_name: "cv.pdf",
        p_content_type: "application/pdf",
        p_size: 2048,
        p_width: null,
        p_height: null,
      },
    });
    expect(createPrivateUploadUrl).toHaveBeenCalledWith({ key: KEY, contentType: "application/pdf", contentLength: 2048 });
  });

  it.each([
    ["files_in_request", 403],
    ["file_rate_limited", 429],
    ["file_too_large", 413],
    ["file_type", 415],
    ["not_found", 404],
  ])("answers the refusal %s with %i", async (status, http) => {
    setMock(signedIn, () => ({ data: { status } }));
    const res = await create(pdf);
    expect(res.status).toBe(http);
    expect((await res.json()).code).toBe(status);
    expect(createPrivateUploadUrl).not.toHaveBeenCalled();
  });
});

describe("POST /api/messages/conversations/:id/attachments/:attachmentId", () => {
  const confirm = (id = FILE_ID) => CONFIRM(json("/x", "POST"), file(id));

  it("401 for a guest, 400 for a bad id", async () => {
    setMock(null);
    expect((await confirm()).status).toBe(401);
    setMock(signedIn);
    expect((await confirm("x")).status).toBe(400);
  });

  it("reads the object back and lets the database compare", async () => {
    setMock(signedIn);
    const res = await confirm();
    expect(res.status).toBe(200);
    expect(holder.adminCalls[0]).toEqual({
      fn: "confirm_message_attachment",
      args: {
        p_attachment_id: FILE_ID,
        p_user_id: USER,
        p_storage_key: KEY,
        p_size: 2048,
        p_content_type: "application/pdf",
      },
    });
  });

  it("passes an unknown type as null, and erases a mismatch at once", async () => {
    storage.object = { size: 10, head: new TextEncoder().encode("<html><script>") };
    holder.adminRpc = () => ({ data: { status: "file_mismatch", storage_key: KEY } });
    setMock(signedIn);
    const res = await confirm();
    expect(res.status).toBe(415);
    expect((await res.json()).code).toBe("file_mismatch");
    expect((holder.adminCalls[0].args as { p_content_type: unknown }).p_content_type).toBeNull();
    expect(deleteFromPrivateR2).toHaveBeenCalledWith(KEY);
  });

  it("an upload that never arrived", async () => {
    storage.object = null;
    setMock(signedIn);
    const res = await confirm();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("file_missing");
    expect(holder.adminCalls).toHaveLength(0);
  });

  it("storage or the service key unavailable", async () => {
    storage.inspectError = new Error("boom");
    setMock(signedIn);
    expect((await confirm()).status).toBe(503);
    storage.inspectError = null;
    holder.admin = false;
    expect((await confirm()).status).toBe(503);
  });
});

describe("DELETE /api/messages/conversations/:id/attachments/:attachmentId", () => {
  it("takes an unsent file out and erases its object", async () => {
    setMock(signedIn, () => ({ data: { status: "ok" } }));
    expect((await DISCARD(json("/x", "DELETE"), file())).status).toBe(200);
    expect(holder.rpcCalls[0]).toEqual({ fn: "discard_message_attachment", args: { p_attachment_id: FILE_ID } });
    expect(deleteFromPrivateR2).toHaveBeenCalledWith(KEY);
  });

  it("404 for someone else's or a sent file", async () => {
    setMock(signedIn, () => ({ data: { status: "not_found" } }));
    expect((await DISCARD(json("/x", "DELETE"), file())).status).toBe(404);
    expect(deleteFromPrivateR2).not.toHaveBeenCalled();
  });
});

describe("GET /api/messages/attachments/:id", () => {
  const open = (query = "") => FILE(new Request(`http://test/api/messages/attachments/${FILE_ID}${query}`), byId());
  const allowed = { status: "ok", storage_key: KEY, content_type: "application/pdf", file_name: "Резюме.pdf" };

  it("redirects to a short-lived link, never cached", async () => {
    setMock(signedIn, () => ({ data: allowed }));
    const res = await open();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`https://bucket.r2.test/${KEY}?get`);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(holder.rpcCalls[0]).toEqual({ fn: "message_attachment_access", args: { p_attachment_id: FILE_ID } });
    expect(createPrivateDownloadUrl).toHaveBeenCalledWith({
      key: KEY,
      contentType: "application/pdf",
      contentDisposition: `inline; filename="_.pdf"; filename*=UTF-8''%D0%A0%D0%B5%D0%B7%D1%8E%D0%BC%D0%B5.pdf`,
      expiresIn: 300,
    });
  });

  it("as a download when asked", async () => {
    setMock(signedIn, () => ({ data: allowed }));
    await open("?download=1");
    expect(vi.mocked(createPrivateDownloadUrl).mock.calls[0][0].contentDisposition).toMatch(/^attachment;/);
  });

  it("404 for anyone who may not see it, 401 for a guest", async () => {
    setMock(signedIn, () => ({ data: { status: "not_found" } }));
    expect((await open()).status).toBe(404);
    setMock(null);
    expect((await open()).status).toBe(401);
    setMock(signedIn);
    expect((await FILE(new Request("http://test/x"), byId("nope"))).status).toBe(404);
    expect(createPrivateDownloadUrl).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/message-attachments/:id", () => {
  const open = (query = `?report=${REPORT}`) =>
    ADMIN_FILE(new Request(`http://test/api/admin/message-attachments/${FILE_ID}${query}`), byId());

  it("only for admins, only with the report", async () => {
    setMock(signedIn);
    holder.viewer = { user: null, isAdmin: false };
    expect((await open()).status).toBe(401);
    holder.viewer = { user: { id: USER }, isAdmin: false };
    expect((await open()).status).toBe(403);
    holder.viewer = { user: { id: USER }, isAdmin: true };
    expect((await open("")).status).toBe(404);
    expect(holder.rpcCalls).toHaveLength(0);
  });

  it("opens a file the report holds", async () => {
    setMock(signedIn, () => ({ data: { status: "ok", storage_key: KEY, content_type: "image/webp", file_name: "a.webp" } }));
    holder.viewer = { user: { id: USER }, isAdmin: true };
    const res = await open();
    expect(res.status).toBe(302);
    expect(holder.rpcCalls[0]).toEqual({
      fn: "admin_message_attachment",
      args: { p_report_id: REPORT, p_attachment_id: FILE_ID },
    });
  });

  it("not a file outside the report; the database's own refusal", async () => {
    holder.viewer = { user: { id: USER }, isAdmin: true };
    setMock(signedIn, () => ({ data: { status: "not_found" } }));
    expect((await open()).status).toBe(404);
    setMock(signedIn, () => ({ error: { code: "42501", message: "only platform admins" } }));
    expect((await open()).status).toBe(403);
  });
});
