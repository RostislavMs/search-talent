import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseMock,
  type MockUser,
  type QueryResult,
  type SupabaseMock,
} from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/db/github-sync", () => ({ syncProjectFromGitHub: vi.fn() }));

import { POST as pinPost, DELETE as pinDelete } from "@/app/api/projects/[id]/pin/route";
import { POST as unlinkPost } from "@/app/api/projects/[id]/unlink-github/route";
import { POST as syncPost } from "@/app/api/projects/[id]/sync-github/route";
import { rateLimit } from "@/lib/rate-limit";
import { syncProjectFromGitHub } from "@/lib/db/github-sync";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };

function setMock(user: MockUser, resolve: (t: string, v: string) => QueryResult = () => ({}), rpc?: () => QueryResult) {
  holder.mock = createSupabaseMock({ user, resolve: (c) => resolve(c.table, c.verb), rpc });
  return holder.mock;
}
const params = () => ({ params: Promise.resolve({ id: PROJECT_ID }) });
const req = () => new Request("http://x", { method: "POST" });
const ownedProject = (t: string): QueryResult => (t === "projects" ? { data: { id: PROJECT_ID, owner_id: USER_ID } } : {});

beforeEach(() => vi.mocked(rateLimit).mockReturnValue(null));
afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("projects/[id]/pin", () => {
  it("401 when unauthenticated", async () => {
    setMock(null);
    expect((await pinPost(req(), params())).status).toBe(401);
  });

  it("404 when the caller does not own the project", async () => {
    setMock(authUser, (t) => (t === "projects" ? { data: { id: PROJECT_ID, owner_id: OTHER } } : {}));
    expect((await pinPost(req(), params())).status).toBe(404);
  });

  it("pins via the set_pinned_project RPC", async () => {
    const rpc = vi.fn(() => ({ error: null }));
    setMock(authUser, ownedProject, rpc);
    const res = await pinPost(req(), params());
    expect(res.status).toBe(200);
    expect((await res.json()).pinned).toBe(true);
    expect(rpc).toHaveBeenCalled();
  });

  it("unpins via DELETE", async () => {
    const rpc = vi.fn(() => ({ error: null }));
    setMock(authUser, ownedProject, rpc);
    const res = await pinDelete(req(), params());
    expect(res.status).toBe(200);
    expect((await res.json()).pinned).toBe(false);
  });
});

describe("projects/[id]/unlink-github", () => {
  it("401 when unauthenticated", async () => {
    setMock(null);
    expect((await unlinkPost(req(), params())).status).toBe(401);
  });

  it("clears the github_* columns for the owner", async () => {
    const mock = setMock(authUser, () => ({ error: null }));
    const res = await unlinkPost(req(), params());
    expect(res.status).toBe(200);
    const update = mock.calls.find((c) => c.table === "projects" && c.verb === "update");
    expect((update?.payload as { github_full_name: null }).github_full_name).toBeNull();
    expect((update?.payload as { github_auto_sync: boolean }).github_auto_sync).toBe(false);
  });
});

describe("projects/[id]/sync-github", () => {
  it("401 when unauthenticated", async () => {
    setMock(null);
    expect((await syncPost(req(), params())).status).toBe(401);
  });

  it("maps sync failure reasons to statuses (not_connected -> 409)", async () => {
    setMock(authUser);
    vi.mocked(syncProjectFromGitHub).mockResolvedValue({ ok: false, reason: "not_connected" } as never);
    expect((await syncPost(req(), params())).status).toBe(409);
  });

  it("maps not_found -> 404", async () => {
    setMock(authUser);
    vi.mocked(syncProjectFromGitHub).mockResolvedValue({ ok: false, reason: "not_found" } as never);
    expect((await syncPost(req(), params())).status).toBe(404);
  });

  it("returns the refreshed snapshot on success", async () => {
    setMock(authUser);
    vi.mocked(syncProjectFromGitHub).mockResolvedValue({
      ok: true, syncedAt: "2026-07-22T00:00:00Z", stats: { stars: 3 }, techStack: ["ts"],
    } as never);
    const res = await syncPost(req(), params());
    expect(res.status).toBe(200);
    expect((await res.json()).techStack).toEqual(["ts"]);
  });
});
