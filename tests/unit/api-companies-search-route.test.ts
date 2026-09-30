import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock, type MockUser, type SupabaseMock } from "./helpers/supabase-mock";

const { holder } = vi.hoisted(() => ({ holder: { mock: null as SupabaseMock | null } }));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => holder.mock!.client) }));

import { GET } from "@/app/api/companies/search/route";

const signedIn: MockUser = { id: "11111111-1111-4111-8111-111111111111" };

function setMock(user: MockUser, data: unknown = []) {
  holder.mock = createSupabaseMock({ user, resolve: () => ({ data }) });
  return holder.mock;
}

const get = (q: string) => GET(new Request(`http://test/api/companies/search?q=${encodeURIComponent(q)}`));

afterEach(() => {
  holder.mock = null;
});

describe("GET /api/companies/search", () => {
  it("gives guests nothing", async () => {
    const mock = setMock(null);
    expect(await (await get("acme")).json()).toEqual({ companies: [] });
    expect(mock.calls).toHaveLength(0);
  });

  it("does not query for an empty or structural-only query", async () => {
    const mock = setMock(signedIn);
    await get("  ");
    await get("%,()");
    expect(mock.calls).toHaveLength(0);
  });

  it("searches approved pages by name and maps them", async () => {
    const mock = setMock(signedIn, [
      { id: "c1", slug: "acme", name: "Acme", logo_url: null, verified_at: "2026-09-30" },
    ]);
    const body = await (await get("Ромашка")).json();
    expect(body).toEqual({
      companies: [{ id: "c1", slug: "acme", name: "Acme", logoUrl: null, verified: true }],
    });
    expect(mock.calls[0].filters).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["moderation_status", "approved"] },
        { method: "ilike", args: ["name", "%Ромашка%"] },
      ]),
    );
  });
});
