import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));
vi.mock("@/lib/db/search", () => ({ searchDiscovery: vi.fn(async () => ({ projects: [], users: [], totals: { projects: 0, users: 0 } })) }));

import { GET } from "@/app/api/search/route";
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
});
