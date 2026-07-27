import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/db/search", () => ({ searchDiscovery: vi.fn(async () => ({ projects: [], users: [], totals: { projects: 0, users: 0 } })) }));
vi.mock("@/lib/db/affinity", () => ({ loadViewerAffinity: vi.fn(async () => null) }));

import { GET } from "@/app/api/search/route";
import { loadViewerAffinity } from "@/lib/db/affinity";
import { searchDiscovery } from "@/lib/db/search";

afterEach(() => {
  holder.mock = null;
  vi.clearAllMocks();
});

describe("GET /api/search", () => {
  it("returns the searchDiscovery result", async () => {
    holder.mock = createSupabaseMock({ resolve: () => ({}) });
    const res = await GET(new Request("http://test/api/search?q=react"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ projects: [], users: [], totals: { projects: 0, users: 0 } });
  });

  it("parses list/number params into the discovery query", async () => {
    holder.mock = createSupabaseMock({ resolve: () => ({}) });
    await GET(new Request("http://test/api/search?skillIds=1,2,2,x&page=3&hasMedia=1&scope=projects"));
    const [query] = vi.mocked(searchDiscovery).mock.calls[0];
    expect(query.skillIds).toEqual([1, 2]);
    expect(query.page).toBe(3);
    expect(query.hasMedia).toBe(true);
    expect(query.scope).toBe("projects");
  });

  it("skips the affinity load for impersonal sorts", async () => {
    holder.mock = createSupabaseMock({ resolve: () => ({}) });
    await GET(new Request("http://test/api/search?sort=rating"));
    expect(vi.mocked(loadViewerAffinity)).not.toHaveBeenCalled();
    expect(vi.mocked(searchDiscovery).mock.calls[0][2]).toBeNull();
  });

  it("resolves the viewer only when the request asks for a personalised sort", async () => {
    holder.mock = createSupabaseMock({ resolve: () => ({}) });
    holder.mock.client.auth = {
      getUser: vi.fn(async () => ({ data: { user: { id: "viewer-1" } } })),
    } as unknown as typeof holder.mock.client.auth;

    await GET(new Request("http://test/api/search?sort=forYou"));

    expect(vi.mocked(loadViewerAffinity)).toHaveBeenCalledWith(
      holder.mock.client,
      "viewer-1",
    );
  });
});
