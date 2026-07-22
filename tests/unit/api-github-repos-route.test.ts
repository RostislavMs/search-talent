import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/db/github-integrations", () => ({ getIntegrationForUser: vi.fn(async () => null) }));
vi.mock("@/lib/integrations/github", () => ({
  listUserRepos: vi.fn(async () => []),
  fetchRepoFullDetail: vi.fn(async () => null),
}));

import { GET as reposGet } from "@/app/api/integrations/github/repos/route";
import { GET as repoGet } from "@/app/api/integrations/github/repo/route";
import { rateLimit } from "@/lib/rate-limit";
import { getIntegrationForUser } from "@/lib/db/github-integrations";
import { listUserRepos, fetchRepoFullDetail } from "@/lib/integrations/github";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const authUser: MockUser = { id: USER_ID, email_confirmed_at: "2026-01-01T00:00:00Z" };
const integration = { access_token: "gho_secret" };

function setUser(user: MockUser) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({}) });
}

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("GET /api/integrations/github/repos", () => {
  const req = () => new Request("http://test/api/integrations/github/repos");

  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await reposGet()).status).toBe(401);
  });

  it("429 when rate limited", async () => {
    setUser(authUser);
    vi.mocked(rateLimit).mockReturnValueOnce(new Response(null, { status: 429 }) as never);
    expect((await reposGet()).status).toBe(429);
  });

  it("409 when GitHub is not connected", async () => {
    setUser(authUser);
    vi.mocked(getIntegrationForUser).mockResolvedValueOnce(null as never);
    const res = await reposGet();
    expect(res.status).toBe(409);
    expect(vi.mocked(listUserRepos)).not.toHaveBeenCalled();
  });

  it("returns the viewer's repos without leaking the token", async () => {
    setUser(authUser);
    vi.mocked(getIntegrationForUser).mockResolvedValueOnce(integration as never);
    vi.mocked(listUserRepos).mockResolvedValueOnce([{ name: "repo-a" }] as never);
    const res = await reposGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ repos: [{ name: "repo-a" }] });
    expect(JSON.stringify(body)).not.toContain("gho_secret");
    expect(vi.mocked(listUserRepos)).toHaveBeenCalledWith("gho_secret");
  });

  // Kept for symmetry: the repos handler ignores request args.
  void req;
});

describe("GET /api/integrations/github/repo", () => {
  const req = (fullName?: string) =>
    new Request(
      `http://test/api/integrations/github/repo${fullName != null ? `?fullName=${encodeURIComponent(fullName)}` : ""}`,
    );

  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await repoGet(req("owner/repo"))).status).toBe(401);
  });

  it("400 for a malformed repository identifier", async () => {
    setUser(authUser);
    expect((await repoGet(req("not-a-repo"))).status).toBe(400);
    expect(vi.mocked(getIntegrationForUser)).not.toHaveBeenCalled();
  });

  it("409 when GitHub is not connected", async () => {
    setUser(authUser);
    vi.mocked(getIntegrationForUser).mockResolvedValueOnce(null as never);
    expect((await repoGet(req("owner/repo"))).status).toBe(409);
    expect(vi.mocked(fetchRepoFullDetail)).not.toHaveBeenCalled();
  });

  it("404 when the repository detail cannot be fetched", async () => {
    setUser(authUser);
    vi.mocked(getIntegrationForUser).mockResolvedValueOnce(integration as never);
    vi.mocked(fetchRepoFullDetail).mockResolvedValueOnce(null as never);
    expect((await repoGet(req("owner/repo"))).status).toBe(404);
  });

  it("returns the repo detail on success", async () => {
    setUser(authUser);
    vi.mocked(getIntegrationForUser).mockResolvedValueOnce(integration as never);
    vi.mocked(fetchRepoFullDetail).mockResolvedValueOnce({ fullName: "owner/repo" } as never);
    const res = await repoGet(req("owner/repo"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ repo: { fullName: "owner/repo" } });
    expect(vi.mocked(fetchRepoFullDetail)).toHaveBeenCalledWith("gho_secret", "owner/repo");
  });
});
